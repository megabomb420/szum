import raw from '../data/track.json';

export type Track = {
  title: string;
  duration: number;
  sampleRate: number;
  boundaries: number[];
  peaks: Array<[number, number]>;
};

export const track = raw as Track;

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
