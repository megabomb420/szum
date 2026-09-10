/**
 * Jedna fraza na odcinek utworu.
 *
 * Granice pochodzą z analizy nagrania (`src/data/track.json`), więc tekst
 * pojawia się tam, gdzie faktycznie zmienia się tekstura dźwięku, a nie
 * w losowych momentach. Kolejność ma znaczenie: pierwsza fraza należy do
 * odcinka przed pierwszą granicą, ostatnia — do wybrzmienia.
 *
 * Podmiana tekstu to edycja tej jednej tablicy. Jeśli wpiszesz mniej fraz niż
 * jest odcinków, dalsze odcinki zostaną bez tekstu.
 */
export const phrases: string[] = [
  'twoje nogi nic nie ważą',
  'kryształ cię wzywa',
  'nie ma tu podłogi',
  'światło przechodzi przez ciebie',
  'jest cię o trochę mniej',
  'to nie ty się poruszasz',
  'zostań jeszcze chwilę',
];

// Ile sekund po wejściu w odcinek tekst się wysnuwa...
export const APPEAR_AFTER = 4;
// ...i jak długo zostaje, zanim zniknie.
export const HOLD_FOR = 9;

/** Numer odcinka między granicami, do którego należy dana sekunda utworu. */
export function segmentIndex(time: number, boundaries: number[]): number {
  let index = 0;
  for (let i = 0; i < boundaries.length; i++) {
    if (time >= boundaries[i]) index = i + 1;
  }
  return index;
}
