import type { Stage } from './loop';

let current: Stage | null = null;

export function setStage(stage: Stage | null): void {
  current = stage;
}

export function captureFrame(): Promise<Blob | null> {
  return current ? current.capture() : Promise.resolve(null);
}
