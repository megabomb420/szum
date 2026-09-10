import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Track } from '../lib/track';

type Props = {
  track: Track;
  progress: number;
  onSeek: (fraction: number) => void;
};

export default function Waveform({ track, progress, onSeek }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Skalujemy do najgłośniejszego miejsca w utworze, żeby pasek wypełniał wysokość.
  const amplitude = useMemo(() => {
    let max = 0;
    for (const [lo, hi] of track.peaks) {
      max = Math.max(max, Math.abs(lo), Math.abs(hi));
    }
    return max || 1;
  }, [track]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const mid = height / 2;
    const scale = (mid * 0.92) / amplitude;
    const count = track.peaks.length;
    const slot = width / count;
    const barWidth = Math.max(slot * 0.72, 0.7);
    const played = progress * width;

    for (let i = 0; i < count; i++) {
      const [lo, hi] = track.peaks[i];
      const x = i * slot;
      const top = mid - hi * scale;
      const bottom = mid - lo * scale;
      ctx.fillStyle = x + barWidth <= played ? 'rgba(244,243,241,0.92)' : 'rgba(244,243,241,0.26)';
      ctx.fillRect(x, top, barWidth, Math.max(bottom - top, 0.9));
    }

    ctx.fillStyle = '#7fd6ff';
    ctx.fillRect(Math.min(played, width - 1), 0, 1.5, height);
  }, [amplitude, progress, track]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const seekFrom = useCallback(
    (clientX: number, target: HTMLElement) => {
      const rect = target.getBoundingClientRect();
      onSeek((clientX - rect.left) / rect.width);
    },
    [onSeek],
  );

  return (
    <div
      className="waveform"
      role="slider"
      tabIndex={0}
      aria-label="Pozycja w utworze"
      aria-valuemin={0}
      aria-valuemax={Math.round(track.duration)}
      aria-valuenow={Math.round(progress * track.duration)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekFrom(event.clientX, event.currentTarget);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 1) seekFrom(event.clientX, event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') onSeek(Math.max(0, progress - 0.02));
        if (event.key === 'ArrowRight') onSeek(Math.min(1, progress + 0.02));
      }}
    >
      <canvas ref={canvasRef} className="waveform__canvas" aria-hidden="true"></canvas>
      <div className="waveform__marks" aria-hidden="true">
        {track.boundaries.map((seconds) => (
          <span
            key={seconds}
            className="waveform__mark"
            style={{ left: `${(seconds / track.duration) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
