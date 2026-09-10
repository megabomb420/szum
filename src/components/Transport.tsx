import { useCallback, useEffect, useState } from 'react';
import {
  getState,
  peek,
  seekBy,
  seekFraction,
  toggle,
  warmUp,
  type AudioFeatures,
  type PlaybackState,
} from '../lib/audio';
import { formatTime, track } from '../lib/track';
import Phrase from './Phrase';
import Waveform from './Waveform';

const BANDS = [
  { key: 'low', label: '30–250 Hz' },
  { key: 'mid', label: '250 Hz–2k' },
  { key: 'high', label: '2k–16k' },
] as const;

export default function Transport() {
  const [state, setState] = useState<PlaybackState>(getState);
  const [features, setFeatures] = useState<AudioFeatures>(peek);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    warmUp();
    const id = window.setInterval(() => {
      setState(getState());
      setFeatures({ ...peek() });
    }, 60);
    return () => window.clearInterval(id);
  }, []);

  const flip = useCallback(async () => {
    setError(null);
    try {
      await toggle();
      setStarted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się odtworzyć utworu.');
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'BUTTON', 'TEXTAREA'].includes(target.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        void flip();
      }
      if (event.key === 'ArrowLeft') seekBy(-5);
      if (event.key === 'ArrowRight') seekBy(5);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flip]);

  const duration = state.duration > 0 ? state.duration : track.duration;
  const progress = duration > 0 ? state.currentTime / duration : 0;

  return (
    <>
      <Phrase time={state.currentTime} boundaries={track.boundaries} />

      <div className={`overlay${started ? ' is-gone' : ''}`}>
        <div className="overlay__inner">
          <button
            type="button"
            className="play"
            onClick={flip}
            aria-label={state.playing ? 'Zatrzymaj' : 'Odtwórz utwór'}
          >
            <span className="play__glyph" aria-hidden="true">
              {state.playing ? '❙❙' : '▶'}
            </span>
          </button>
          <p className="overlay__meta">{formatTime(duration)} · 48 kHz · stereo</p>
          {error && <p className="overlay__error">{error}</p>}
        </div>
      </div>

      <header className="head">
        <h1 className="head__title">{track.title}</h1>
        <p className="head__note">poziom, pasma i środek widma — na żywo · kliknij w waveformę, żeby przeskoczyć</p>
      </header>

      <footer className="bar">
        <div className="bar__transport">
          <button type="button" className="bar__button" onClick={flip}>
            {state.playing ? 'Pauza' : 'Graj'}
          </button>
          <span className="bar__time">
            {formatTime(state.currentTime)}
            <em> / {formatTime(duration)}</em>
          </span>
        </div>

        <Waveform track={track} progress={progress} onSeek={seekFraction} />

        <div className="readout">
          <div className="meter">
            <span className="meter__label">Poziom</span>
            <span className="meter__track">
              <i style={{ transform: `scaleX(${features.level})` }} />
            </span>
            <span className="meter__value">{Math.round(features.level * 100)}</span>
          </div>

          {BANDS.map((band) => (
            <div className="meter" key={band.key}>
              <span className="meter__label">{band.label}</span>
              <span className="meter__track">
                <i style={{ transform: `scaleX(${features[band.key]})` }} />
              </span>
            </div>
          ))}

          <div className="meter meter--plain">
            <span className="meter__label">Środek widma</span>
            <span className="meter__value">{Math.round(features.centroidHz)} Hz</span>
          </div>
        </div>
      </footer>
    </>
  );
}
