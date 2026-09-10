# Weightless — obraz generowany z utworu

Strona jest odtwarzaczem, a obraz robi się z dźwięku. Nie ma tu przewijania ani rozdziałów:
klikasz play i patrzysz, jak utwór rysuje sam siebie. Na dole leży prawdziwa waveforma
całego nagrania — klikasz w dowolnym miejscu i przeskakujesz, a obraz skacze razem z Tobą.

**Na żywo:** https://megabomb420.github.io/szum/

## Co steruje obrazem

Obraz nie odgrywa wymyślonych nastrojów — karmi się tym, co faktycznie leci:

| Sygnał | Skąd | Co robi |
| --- | --- | --- |
| poziom | RMS z przebiegu czasowego | jasność i ekspozycja kadru |
| 30–250 Hz | AnalyserNode | masa i tarasowanie warstw |
| 250 Hz–2k | AnalyserNode | zawirowanie pola |
| 2k–16k | AnalyserNode | ziarno i filamenty |
| środek widma | ważona średnia częstotliwości | pozycja w palecie |
| atak | dodatnia pochodna poziomu | rozbłysk krawędzi warstw |
| pozycja w utworze | `currentTime / duration` | łuk przez cały kawałek |

Wszystkie liczby widać na żywo w prawym dolnym rogu — to nie dekoracja, tylko odczyt
z analizatora. Można je porównać z tym, co słychać.

## Ten konkretny utwór

Liczby są zmierzone offline, nie założone — plik został zdekodowany, a widmo policzone
ramka po ramce:

- **3:18**, 48 kHz, stereo, MP3 64 kbps
- RMS między ok. **-22 dB i -9 dB** — zakres, pod który dobrana jest normalizacja poziomu
- mocno niskotonowy: pasmo 30–250 Hz ma średnią **105.7** przy **12.5** dla 2k–16k
- środek widma średnio **2093 Hz**, ale od 550 Hz w intro do ~4500 Hz w dalszej części
- granice zmiany tekstury w **31.6 s, 62 s, 91.5 s, 128.8 s, 149.4 s, 170 s**
  (zaznaczone cienkimi kreskami na waveformie)

To jest utwór ciągły, bez zwrotkowo-refrenowej struktury. Dlatego obraz płynie, a nie ciął
się na sekcje.

## Frazy

W siedmiu miejscach na ekranie wysnuwa się jedno zdanie — po jednym na odcinek utworu.
Nie pojawiają się losowo: każda fraza należy do odcinka wyznaczonego przez zmierzone
granice, więc przy każdym odsłuchu wraca dokładnie w to samo miejsce.

Tekst wchodzi **4 sekundy** po zmianie odcinka, zostaje **9 sekund** i rozpływa się przez
niecałe 2 sekundy. Cała treść siedzi w jednej tablicy — `src/lib/phrases.ts`. Podmiana
albo dopisanie frazy to edycja tylko tego pliku; stałe `APPEAR_AFTER` i `HOLD_FOR` obok
sterują czasem.

## Stack

- **Astro 7** (`output: "static"`), **React 19** przez `@astrojs/react`
- **WebGL2 bez three.js** — pełnoekranowy trójkąt z `gl_VertexID` i jeden fragment shader
- **Web Audio API** — `MediaElementSource` → `AnalyserNode` → `destination`
- TypeScript w trybie strict

## Struktura

```
src/
├── pages/index.astro
├── layouts/Base.astro
├── components/
│   ├── Stage.astro            # <canvas> + bootstrap WebGL
│   ├── Transport.tsx          # play, zegar, odczyt danych
│   ├── Waveform.tsx           # pasek z prawdziwych szczytów nagrania
│   └── ControlPanel.tsx       # paleta, czułość, kontrast, zrzut klatki
├── shaders/stage.frag.glsl    # cały obraz
├── lib/
│   ├── audio.ts               # graf audio i cechy dźwięku
│   ├── loop.ts                # pętla rAF, uniformy, DPR, adaptacyjna jakość
│   ├── gl.ts                  # kontekst, kompilacja, pełnoekranowy trójkąt
│   ├── controls.ts            # parametry obrazu
│   ├── track.ts               # dane waveformy i granic
│   └── bridge.ts              # dostęp wyspy do sceny (zrzut klatki)
├── data/track.json            # 700 słupków min/max + granice sekcji (8.9 KB)
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

- **`base: "/szum"`**, bo strona żyje w podkatalogu GitHub Pages. `import.meta.env.BASE_URL`
  nie ma w tym wypadku końcowego ukośnika — od sklejania ścieżek jest `src/lib/base.ts`.
- **`public/.nojekyll`** — Astro buduje assety do `_astro/`, a Jekyll domyślnie pomija
  katalogi zaczynające się od podkreślnika.
- **Kalibracja pasm jest samo-dostrajająca**: każde pasmo trzyma własny, powoli opadający
  poziom odniesienia, więc wskaźniki nie są przywiązane do jednego utworu na sztywno.
- **Normalizacja poziomu jest dobrana pod ten utwór** — jego RMS siedzi między ok. -22 dB
  i -9 dB, więc szersze okno przypinało wskaźnik na maksimum i gubiło całą dynamikę.
  Przy podmianie nagrania to pierwsze miejsce do poprawy: `src/lib/audio.ts`, linia
  z `clamp01((levelDb + 26) / 18)`.
- **AudioContext powstaje dopiero przy pierwszym kliknięciu** — przeglądarki nie pozwalają
  inaczej, a przy okazji strona nie ładuje 4.8 MB, dopóki ktoś nie zechce posłuchać.
- **Zrzut klatki** działa bez `preserveDrawingBuffer`: `capture()` renderuje klatkę i woła
  `canvas.toBlob` w tym samym zadaniu.
- **Bez WebGL2** zostaje tło z CSS, a `document.documentElement.dataset.stage` przyjmuje
  wartość `fallback`.
