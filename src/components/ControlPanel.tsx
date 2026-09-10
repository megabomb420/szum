import { useCallback, useEffect, useState } from 'react';
import { captureFrame } from '../lib/bridge';
import {
  PALETTES,
  getControls,
  resetControls,
  setControls,
  subscribeControls,
  type Controls,
} from '../lib/controls';

export default function ControlPanel() {
  const [controls, setLocal] = useState<Controls>(getControls);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeControls(setLocal), []);

  const onExport = useCallback(async () => {
    setSaving(true);
    try {
      const blob = await captureFrame();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `weightless-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <div className="panel">
      {open && (
        <div className="panel__card">
          <div className="panel__field">
            <label className="panel__label" htmlFor="ctrl-scale">
              <span>Skala</span>
              <span>{controls.scale.toFixed(2)}</span>
            </label>
            <input
              id="ctrl-scale"
              type="range"
              min="0.4"
              max="2.4"
              step="0.01"
              value={controls.scale}
              onChange={(event) => setControls({ scale: Number(event.target.value) })}
            />
          </div>

          <div className="panel__field">
            <label className="panel__label" htmlFor="ctrl-sensitivity">
              <span>Czułość na dźwięk</span>
              <span>{controls.sensitivity.toFixed(2)}</span>
            </label>
            <input
              id="ctrl-sensitivity"
              type="range"
              min="0.2"
              max="2.5"
              step="0.01"
              value={controls.sensitivity}
              onChange={(event) => setControls({ sensitivity: Number(event.target.value) })}
            />
          </div>

          <div className="panel__field">
            <label className="panel__label" htmlFor="ctrl-contrast">
              <span>Kontrast</span>
              <span>{controls.contrast.toFixed(2)}</span>
            </label>
            <input
              id="ctrl-contrast"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={controls.contrast}
              onChange={(event) => setControls({ contrast: Number(event.target.value) })}
            />
          </div>

          <div className="panel__field">
            <span className="panel__label">
              <span>Paleta</span>
            </span>
            <div className="panel__palettes">
              {PALETTES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="panel__palette"
                  aria-pressed={controls.palette === item.id}
                  onClick={() => setControls({ palette: item.id })}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel__actions">
            <button type="button" className="panel__action" onClick={resetControls}>
              Reset
            </button>
            <button type="button" className="panel__action" onClick={onExport} disabled={saving}>
              {saving ? 'Zapisuję' : 'Zapisz klatkę'}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="panel__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="panel__dot" aria-hidden="true" />
        {open ? 'Zamknij' : 'Obraz'}
      </button>
    </div>
  );
}
