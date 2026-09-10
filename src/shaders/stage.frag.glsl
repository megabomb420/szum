#version 300 es
precision highp float;

// Wejście: pozycja w utworze + to, co faktycznie gra.
uniform vec2 uRes;
uniform float uTime;   // czas od startu sceny (do autonomicznego dryfu)
uniform float uDrift;  // 0..1 — pozycja w utworze
uniform vec2 uPointer;
uniform float uQuality;
uniform float uScale;
uniform float uContrast;
uniform int uPalette;
uniform float uLevel;     // głośność chwilowa 0..1
uniform float uLow;       // pasmo 30–250 Hz
uniform float uMid;       // 250–2000 Hz
uniform float uHigh;      // 2000–16000 Hz
uniform float uCentroid;  // środek ciężkości widma, 0..1
uniform float uOnset;     // atak — dodatnia pochodna głośności, 0..1
uniform float uPlaying;   // 0 = cisza/przed startem, 1 = gra

in vec2 vUv;
out vec4 fragColor;

const mat2 ROT = mat2(0.80, 0.60, -0.60, 0.80);

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, int oct) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    sum += amp * vnoise(p);
    norm += amp;
    p = ROT * p * 2.03;
    amp *= 0.5;
  }
  return sum / max(norm, 1e-5);
}

float ridged(vec2 p, int oct) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(vnoise(p) * 2.0 - 1.0);
    sum += amp * n * n;
    norm += amp;
    p = ROT * p * 2.07;
    amp *= 0.5;
  }
  return sum / max(norm, 1e-5);
}

float span(float edge0, float edge1, float x) {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

// Trójpunktowa rampa: ciemna baza, półton, akcent.
vec3 ramp(vec3 deep, vec3 mid, vec3 hot, float v) {
  vec3 col = mix(deep, mid, smoothstep(0.00, 0.44, v));
  return mix(col, hot, smoothstep(0.54, 1.0, v));
}

vec3 palette(float v, int id) {
  if (id == 0) {
    return ramp(vec3(0.022, 0.024, 0.030), vec3(0.230, 0.245, 0.270), vec3(0.935, 0.950, 0.965), v);
  }
  if (id == 1) {
    return ramp(vec3(0.010, 0.014, 0.045), vec3(0.085, 0.320, 0.720), vec3(0.400, 0.930, 1.000), v);
  }
  return ramp(vec3(0.040, 0.015, 0.010), vec3(0.640, 0.195, 0.055), vec3(1.000, 0.800, 0.505), v);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float p = clamp(uDrift, 0.0, 1.0);
  float t = uTime;
  int oct = uQuality > 0.66 ? 5 : (uQuality > 0.33 ? 4 : 3);

  float idle = 1.0 - uPlaying;

  // Przebieg przez utwór: pozycja daje łuk, dźwięk go zaburza.
  // Bez tego dziesięciominutowy ambient stałby w jednym miejscu.
  float mNoise = (1.0 - span(0.08, 0.30, p)) * 0.55 + 0.55 * uHigh;
  float mFlow = span(0.08, 0.34, p) * (1.0 - span(0.58, 0.82, p)) * 0.80 + 0.70 * uMid;
  float mStruct = span(0.34, 0.60, p) * (1.0 - span(0.80, 0.97, p)) * 0.75 + 0.90 * uLow;
  float mDark = span(0.62, 0.86, p) * 0.70 + 0.80 * (1.0 - uLevel) * uPlaying + 0.35 * (1.0 - uCentroid);
  float mCalm = span(0.90, 1.00, p) * 0.70 + 0.70 * (1.0 - uLevel) * (1.0 - uHigh) * uPlaying;

  // Przed startem obraz żyje spokojnie, żeby nie było czarnej dziury za przyciskiem.
  mFlow += idle * 0.62;
  mStruct += idle * 0.30;
  mDark += idle * 0.18;

  float wsum = mNoise + mFlow + mStruct + mDark + mCalm + 1e-4;

  float chroma = (mFlow * 1.00 + mStruct * 0.42 + mDark * 0.16 + mCalm * 0.60) / wsum;
  float exposure = (mNoise * 0.80 + mFlow * 1.15 + mStruct * 1.05 + mDark * 0.95 + mCalm * 1.05) / wsum;
  float warpAmt = (mNoise * 0.10 + mFlow * 1.05 + mStruct * 0.44 + mDark * 0.30 + mCalm * 0.08) / wsum;
  float freq = (mNoise * 3.30 + mFlow * 0.80 + mStruct * 2.60 + mDark * 2.30 + mCalm * 0.52) / wsum;
  float grain = (mNoise * 0.085 + 0.010) * (1.0 - 0.6 * mCalm) + 0.055 * uHigh;
  float terrace = mStruct;
  float gamma = mix(1.30, 0.72, mFlow);

  // Bas rozpycha kadr, atak go na chwilę dociąga.
  float punch = 1.0 + 0.22 * uLow + 0.35 * uOnset;
  vec2 uvP = uv - uPointer * 0.10 * mFlow;
  vec2 q = uvP * (uScale * mix(1.1, 2.2, chroma) * freq) * punch;
  q.x *= mix(1.0, 0.32, mNoise * 0.85);

  vec2 w = vec2(
    fbm(q + vec2(t * 0.055, -t * 0.030), oct),
    fbm(q + vec2(5.2, 1.3) + vec2(-t * 0.040, t * 0.050), oct)
  );
  vec2 r = q + warpAmt * (w - 0.5) * 2.0;

  float f = fbm(r, oct);
  float rg = ridged(r * 0.9 + vec2(t * 0.010, 0.0), oct);

  // Warstwy krystalizują się z basu, a atak podbija ich krawędzie.
  float layers = f * 7.0;
  float lf = fract(layers);
  float slab = (floor(layers) + smoothstep(0.52, 1.0, lf)) / 7.0;
  float riser = smoothstep(0.88, 1.0, lf);
  float terraced = mix(f, slab, terrace * 0.90) + riser * terrace * (0.30 + 0.55 * uOnset);

  float filaments = ridged(r * 1.7 - vec2(t * 0.025, 0.0), oct);
  float v = mix(terraced, terraced * 0.50 + filaments * 0.62, mFlow * 0.55 + mDark * 0.45);

  v *= exposure * (0.70 + 0.60 * uLevel * uPlaying + 0.30 * idle);
  v = pow(clamp(v, 0.0, 1.0), gamma);

  float g = hash21(gl_FragCoord.xy + fract(t * 3.0) * 137.0) - 0.5;
  v += g * grain;

  float vig = 1.0 - dot(uv, uv) * (0.22 + 0.72 * mDark);
  v *= clamp(vig, 0.0, 1.0);

  v = mix(v, 0.44 + (v - 0.44) * 0.72, mCalm);

  v = (v - 0.5) * (1.0 + 1.9 * uContrast) + 0.5;
  v = clamp(v, 0.0, 1.0);

  vec3 col = palette(v + 0.05 * uCentroid, uPalette);

  float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(gray), col, clamp(chroma + 0.25 * uCentroid * uPlaying, 0.0, 1.0));

  // Uderzenie rozjaśnia obraz na jedną klatkę.
  col += uOnset * 0.05;

  col += (hash21(gl_FragCoord.xy * 0.731 + 11.0) - 0.5) / 255.0;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
