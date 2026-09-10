import { asset } from './base';

export type AudioFeatures = {
  level: number;
  low: number;
  mid: number;
  high: number;
  centroid: number;
  centroidHz: number;
  onset: number;
};

export type PlaybackState = {
  playing: boolean;
  ready: boolean;
  currentTime: number;
  duration: number;
};

const SOURCE = asset('audio/weightless.mp3');
const FFT_SIZE = 2048;

// Pasma w hercach. Utwór jest mocno niskotonowy, więc progi są osobne dla każdego.
const BANDS: Array<[number, number]> = [
  [30, 250],
  [250, 2000],
  [2000, 16000],
];

const ATTACK = 0.42;
const RELEASE = 0.055;
const ADAPT = 0.99985; // zanik sufitu pasma — kalibruje się sam pod materiał
const RANGE_DB = 26;

let element: HTMLAudioElement | null = null;
let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let freqData = new Float32Array(0);
let timeData = new Float32Array(0);
let graphReady = false;

const features: AudioFeatures = {
  level: 0,
  low: 0,
  mid: 0,
  high: 0,
  centroid: 0,
  centroidHz: 0,
  onset: 0,
};
const ceilings = { low: -120, mid: -120, high: -120 };
const listeners = new Set<(state: PlaybackState) => void>();

let slowLevel = 0;
let binHz = 48000 / FFT_SIZE;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function approach(current: number, target: number, rate: number): number {
  return current + (target - current) * (target > current ? ATTACK : rate);
}

function el(): HTMLAudioElement {
  if (element) return element;
  element = new Audio(SOURCE);
  element.preload = 'auto';
  element.addEventListener('loadedmetadata', emit);
  element.addEventListener('play', emit);
  element.addEventListener('pause', emit);
  element.addEventListener('ended', emit);
  return element;
}

function emit(): void {
  const state = getState();
  for (const listener of listeners) listener(state);
}

export function getState(): PlaybackState {
  const node = element;
  return {
    playing: node ? !node.paused && !node.ended : false,
    ready: node ? Number.isFinite(node.duration) && node.duration > 0 : false,
    currentTime: node?.currentTime ?? 0,
    duration: node && Number.isFinite(node.duration) ? node.duration : 0,
  };
}

export function subscribe(listener: (state: PlaybackState) => void): () => void {
  listeners.add(listener);
  listener(getState());
  return () => {
    listeners.delete(listener);
  };
}

// Dla pętli renderującej — bez alokacji obiektu na każdą klatkę.
export function isPlaying(): boolean {
  const node = element;
  return node !== null && !node.paused && !node.ended;
}

export function drift(): number {
  const node = element;
  if (!node || !Number.isFinite(node.duration) || node.duration <= 0) return 0;
  return clamp01(node.currentTime / node.duration);
}

async function ensureGraph(): Promise<void> {
  const node = el();
  if (graphReady) return;

  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  context = new Ctor();

  analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0;
  analyser.minDecibels = -110;
  analyser.maxDecibels = 0;

  freqData = new Float32Array(analyser.frequencyBinCount);
  timeData = new Float32Array(analyser.fftSize);
  binHz = context.sampleRate / FFT_SIZE;

  const source = context.createMediaElementSource(node);
  source.connect(analyser);
  analyser.connect(context.destination);
  graphReady = true;
}

export async function play(): Promise<void> {
  const node = el();
  if (node.error) throw new Error(`Nie udało się wczytać utworu: ${node.error.message}`);
  await ensureGraph();
  await context?.resume();
  await node.play();
  emit();
}

export function pause(): void {
  element?.pause();
}

export async function toggle(): Promise<void> {
  if (getState().playing) pause();
  else await play();
}

export function seek(seconds: number): void {
  const node = el();
  const max = Number.isFinite(node.duration) ? node.duration : 0;
  node.currentTime = clamp01(seconds / Math.max(max, 0.001)) * max;
  emit();
}

export function seekFraction(fraction: number): void {
  const node = el();
  if (!Number.isFinite(node.duration) || node.duration <= 0) return;
  node.currentTime = clamp01(fraction) * node.duration;
  emit();
}

export function seekBy(delta: number): void {
  const node = el();
  node.currentTime = Math.max(0, Math.min(node.duration || 0, node.currentTime + delta));
  emit();
}

export function warmUp(): void {
  el().load();
}

function bandDb(from: number, to: number): number {
  const first = Math.max(1, Math.floor(from / binHz));
  const last = Math.min(freqData.length - 1, Math.ceil(to / binHz));
  let power = 0;
  for (let k = first; k <= last; k++) {
    power += Math.pow(10, freqData[k] / 10);
  }
  return 10 * Math.log10(Math.max(power, 1e-13));
}

function calibrate(key: 'low' | 'mid' | 'high', db: number): number {
  if (ceilings[key] < -119) ceilings[key] = db;
  ceilings[key] = Math.max(db, ceilings[key] * ADAPT + db * (1 - ADAPT));
  const floor = ceilings[key] - RANGE_DB;
  return clamp01((db - floor) / RANGE_DB);
}

/**
 * Wywoływane raz na klatkę przez pętlę renderującą.
 * Zwraca wygładzone cechy dźwięku w zakresie 0..1.
 */
export function read(): AudioFeatures {
  const node = element;
  const active = analyser;

  if (node === null || node.paused || node.ended || active === null) {
    features.level = approach(features.level, 0, 0.05);
    features.low = approach(features.low, 0, 0.05);
    features.mid = approach(features.mid, 0, 0.05);
    features.high = approach(features.high, 0, 0.05);
    features.centroid = approach(features.centroid, 0, 0.05);
    features.centroidHz = approach(features.centroidHz, 0, 0.05);
    features.onset = approach(features.onset, 0, 0.12);
    return features;
  }

  active.getFloatFrequencyData(freqData);
  active.getFloatTimeDomainData(timeData);

  let sum = 0;
  for (let i = 0; i < timeData.length; i++) sum += timeData[i] * timeData[i];
  const rms = Math.sqrt(sum / timeData.length);
  const levelDb = 20 * Math.log10(Math.max(rms, 1e-6));
  // Zakres dobrany pod ten utwór: jego RMS siedzi między ok. -22 dB i -9 dB,
  // więc szersze okno przypinało wskaźnik na maksimum i gubiło całą dynamikę.
  const level = clamp01((levelDb + 26) / 18);

  let wsum = 0;
  let csum = 0;
  for (let k = 1; k < freqData.length; k++) {
    const hz = k * binHz;
    if (hz < 60 || hz > 14000) continue;
    const mag = Math.pow(10, freqData[k] / 20);
    wsum += mag;
    csum += mag * hz;
  }
  const centroidHz = wsum > 0 ? csum / wsum : 0;
  const centroid = clamp01(centroidHz / 6000);

  const low = calibrate('low', bandDb(BANDS[0][0], BANDS[0][1]));
  const mid = calibrate('mid', bandDb(BANDS[1][0], BANDS[1][1]));
  const high = calibrate('high', bandDb(BANDS[2][0], BANDS[2][1]));

  features.level = approach(features.level, level, RELEASE);
  features.low = approach(features.low, low, RELEASE);
  features.mid = approach(features.mid, mid, RELEASE);
  features.high = approach(features.high, high, RELEASE);
  features.centroid = approach(features.centroid, centroid, RELEASE);
  features.centroidHz = approach(features.centroidHz, centroidHz, RELEASE);

  slowLevel += (features.level - slowLevel) * 0.015;
  const transient = clamp01((features.level - slowLevel) * 4.5);
  features.onset += (transient - features.onset) * (transient > features.onset ? 0.65 : 0.16);

  return features;
}

/**
 * Bieżące cechy bez postępu wygładzania — dla interfejsu, który tylko je pokazuje.
 * `read()` należy do pętli renderującej i nie wolno go wołać dwa razy na klatkę.
 */
export function peek(): AudioFeatures {
  return features;
}
