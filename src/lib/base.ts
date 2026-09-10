// `import.meta.env.BASE_URL` przy `base: "/szum"` nie ma końcowego ukośnika,
// więc sklejanie wprost dawało "/szumfavicon.svg" i "/szumaudio/...".
const raw = import.meta.env.BASE_URL;
export const BASE = raw.endsWith('/') ? raw : `${raw}/`;

export function asset(path: string): string {
  return `${BASE}${path.replace(/^\/+/, '')}`;
}
