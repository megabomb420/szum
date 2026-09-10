# SZUM

One-page generatywny kawałek wizualny. Pięć rozdziałów przewijania, jeden pełnoekranowy
shader WebGL2. Obraz zmienia się razem ze scrollem, a panel w prawym dolnym rogu pozwala
grzebać w parametrach i zapisać klatkę jako PNG.

**Na żywo:** https://megabomb420.github.io/szum/

## Rozdziały

| Postęp | Rozdział | Co robi obraz |
| --- | --- | --- |
| 0.00–0.20 | SZUM | ziarno ciągnięte poziomo, monochromatyczne, bez kierunku |
| 0.20–0.45 | FALA | pole dostaje kierunek, domain warping, wchodzi kolor |
| 0.45–0.70 | STRUKTURA | pole tarasowane w warstwy, krystalizacja |
| 0.70–0.90 | ZAĆMIENIE | filamenty, mocna winieta, kolor gaśnie |
| 0.90–1.00 | CISZA | spłaszczenie i spokojny gradient |

## Stack

- **Astro 7** (`output: "static"`) — statyczny HTML, JS doładowywany dopiero gdy trzeba
- **`@astrojs/react`** + React 19 — tylko jedna wyspa, panel sterowania (`client:idle`)
- **WebGL2 bez three.js** — jeden pełnoekranowy trójkąt generowany z `gl_VertexID`
  i jeden fragment shader. Zero zależności graficznych.
- TypeScript w trybie strict

## Struktura

```
src/
├── pages/index.astro          # składa scenę, rozdziały i wyspę
├── layouts/Base.astro
├── components/
│   ├── Stage.astro            # <canvas> + bootstrap WebGL
│   ├── Chapter.astro
│   └── ControlPanel.tsx       # suwaki, palety, eksport PNG
├── shaders/stage.frag.glsl    # cały obraz
├── lib/
│   ├── gl.ts                  # kontekst, kompilacja, pełnoekranowy trójkąt
│   ├── loop.ts                # pętla rAF, uniformy, DPR, adaptacyjna jakość
│   ├── scroll.ts              # postęp scrolla
│   ├── controls.ts            # mini-store dla wyspy
│   └── bridge.ts              # dostęp wyspy do sceny (eksport PNG)
└── styles/global.css
```

## Komendy

```bash
npm install
npm run dev        # http://localhost:4321/szum/
npm run build      # → dist/
npm run preview
npm run check      # TypeScript + diagnostyka Astro
```

## Uwagi techniczne

- **`base: "/szum"`** w `astro.config.mjs`, bo strona żyje w podkatalogu na GitHub Pages.
  Ścieżki do assetów muszą to uwzględniać.
- **`public/.nojekyll`** — Astro buduje assety do `_astro/`, a Jekyll domyślnie pomija
  katalogi zaczynające się od podkreślnika.
- **Eksport PNG** działa bez `preserveDrawingBuffer: true`: `capture()` renderuje klatkę
  i woła `canvas.toBlob` w tym samym zadaniu, więc bufor nie zdąży zostać wyczyszczony.
- **Adaptacyjna jakość** — przy średniej klatce powyżej 22 ms shader schodzi z 5 oktaw
  fbm na 4, potem na 3. Na zintegrowanej grafice to warunek płynności.
- **Bez WebGL2** zostaje tło z CSS, a `document.documentElement.dataset.stage` przyjmuje
  wartość `fallback`.
