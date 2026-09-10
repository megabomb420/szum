export type Controls = {
  scale: number;
  speed: number;
  contrast: number;
  palette: number;
};

export const PALETTES = [
  { id: 0, label: 'GRAFIT' },
  { id: 1, label: 'JON' },
  { id: 2, label: 'ŻAR' },
] as const;

const initial: Controls = {
  scale: 1,
  speed: 1,
  contrast: 0.32,
  palette: 1,
};

let state: Controls = { ...initial };
const listeners = new Set<(value: Controls) => void>();

export function getControls(): Controls {
  return state;
}

export function setControls(patch: Partial<Controls>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

export function resetControls(): void {
  setControls(initial);
}

export function subscribeControls(listener: (value: Controls) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}
