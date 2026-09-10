#version 300 es
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uProgress;
uniform vec2 uPointer;
uniform float uQuality;
uniform float uScale;
uniform float uSpeed;
uniform float uContrast;
uniform int uPalette;

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

// Trójpunktowa rampa: ciemna baza, półton, akcent. Kontrolowany zakres barw
// zamiast tęczowego kosinusa, który dawał błotniste plamy.
// Progi są niskie, bo pole rzadko przekracza 0.5 — inaczej wszystko siedzi w czerni.
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
  float p = clamp(uProgress, 0.0, 1.0);
  float t = uTime * (0.10 + 0.90 * uSpeed);
  int oct = uQuality > 0.66 ? 5 : (uQuality > 0.33 ? 4 : 3);

  // Wagi rozdziałów. Nachodzą na siebie, więc przejścia są ciągłe.
  float mNoise = 1.0 - span(0.10, 0.34, p);
  float mFlow = span(0.10, 0.38, p) * (1.0 - span(0.54, 0.76, p));
  float mStruct = span(0.42, 0.64, p) * (1.0 - span(0.76, 0.94, p));
  float mDark = span(0.66, 0.86, p) * (1.0 - span(0.88, 1.00, p));
  float mCalm = span(0.88, 1.00, p);

  float wsum = mNoise + mFlow + mStruct + mDark + mCalm + 1e-4;

  // Rozdziały różnią się skalą, zawirowaniem i twardością krawędzi,
  // nie tylko odcieniem — inaczej wszystkie wyglądają jak ta sama plama.
  float chroma = (mFlow * 1.00 + mStruct * 0.42 + mDark * 0.16 + mCalm * 0.60) / wsum;
  float exposure = (mNoise * 0.80 + mFlow * 1.15 + mStruct * 1.05 + mDark * 0.95 + mCalm * 1.10) / wsum;
  float warpAmt = (mNoise * 0.10 + mFlow * 1.05 + mStruct * 0.44 + mDark * 0.30 + mCalm * 0.08) / wsum;
  float freq = (mNoise * 3.30 + mFlow * 0.80 + mStruct * 2.60 + mDark * 2.30 + mCalm * 0.52) / wsum;
  float grain = (mNoise * 0.090 + mDark * 0.030 + 0.008) * (1.0 - 0.6 * mCalm);
  float terrace = mStruct;
  float gamma = mix(1.30, 0.72, mFlow);

  // Kadr. Pointer przesuwa kompozycję i tylko w rozdziale „FALA" mocno ją zawirowuje.
  vec2 uvP = uv - uPointer * 0.10 * mFlow;
  vec2 q = uvP * (uScale * mix(1.1, 2.2, chroma) * freq);
  q.x *= mix(1.0, 0.32, mNoise * 0.85); // szum ciągnięty poziomo — sygnał, nie ziarno

  vec2 w = vec2(
    fbm(q + vec2(t * 0.11, -t * 0.06), oct),
    fbm(q + vec2(5.2, 1.3) + vec2(-t * 0.08, t * 0.10), oct)
  );
  vec2 r = q + warpAmt * (w - 0.5) * 2.0;

  float f = fbm(r, oct);
  float rg = ridged(r * 0.9 + vec2(t * 0.02, 0.0), oct);

  // Struktura: pole tarasowane w warstwy. Styk warstw dostaje jasną krawędź,
  // dzięki czemu czyta się jako krystalizacja, a nie kolejna plama.
  float layers = f * 7.0;
  float lf = fract(layers);
  float slab = (floor(layers) + smoothstep(0.52, 1.0, lf)) / 7.0;
  float riser = smoothstep(0.88, 1.0, lf);
  float terraced = mix(f, slab, terrace * 0.90) + riser * terrace * 0.30;

  // Przepływ dostaje żyłę grzbietów, zaćmienie — filamenty.
  float filaments = ridged(r * 1.7 - vec2(t * 0.05, 0.0), oct);
  float v = mix(terraced, terraced * 0.50 + filaments * 0.62, mFlow * 0.55 + mDark * 0.45);

  v *= exposure;
  v = pow(clamp(v, 0.0, 1.0), gamma);

  // Ziarno: drobne, wyłącznie na wierzchu i mocno ograniczone.
  float g = hash21(gl_FragCoord.xy + fract(t * 0.7) * 137.0) - 0.5;
  v += g * grain;

  // Winieta — mocniejsza w zaćmieniu, ale nigdy nie gasi kadru do zera.
  float vig = 1.0 - dot(uv, uv) * (0.22 + 0.72 * mDark);
  v *= clamp(vig, 0.0, 1.0);

  // Cisza: obraz się spłaszcza, ale zostaje czytelny, świetlisty gradient.
  v = mix(v, 0.44 + (v - 0.44) * 0.72, mCalm);

  v = (v - 0.5) * (1.0 + 1.9 * uContrast) + 0.5;
  v = clamp(v, 0.0, 1.0);

  vec3 col = palette(v, uPalette);

  float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(gray), col, clamp(chroma, 0.0, 1.0));

  // Dithering — gradienty bez bandingów.
  col += (hash21(gl_FragCoord.xy * 0.731 + 11.0) - 0.5) / 255.0;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
