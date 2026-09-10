import { createContext, createProgram, drawFullscreen } from './gl';
import { getControls, subscribeControls, type Controls } from './controls';
import { prefersReducedMotion, readTargetProgress, reflectProgress } from './scroll';
import vertexSource from '../shaders/stage.vert.glsl?raw';
import fragmentSource from '../shaders/stage.frag.glsl?raw';

export type Stage = {
  capture: () => Promise<Blob | null>;
  dispose: () => void;
};

const QUALITY_STEP = 1 / 3;
const MIN_QUALITY = 1 / 3;
const SLOW_FRAME_MS = 22;
const FAST_FRAME_MS = 17.5;

function acquireContext(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  try {
    return createContext(canvas);
  } catch {
    return null;
  }
}

export function mountStage(canvas: HTMLCanvasElement): Stage | null {
  const context = acquireContext(canvas);
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;

  const program = createProgram(gl, vertexSource, fragmentSource);
  gl.useProgram(program);

  const uniforms = {
    res: gl.getUniformLocation(program, 'uRes'),
    time: gl.getUniformLocation(program, 'uTime'),
    progress: gl.getUniformLocation(program, 'uProgress'),
    pointer: gl.getUniformLocation(program, 'uPointer'),
    quality: gl.getUniformLocation(program, 'uQuality'),
    scale: gl.getUniformLocation(program, 'uScale'),
    speed: gl.getUniformLocation(program, 'uSpeed'),
    contrast: gl.getUniformLocation(program, 'uContrast'),
    palette: gl.getUniformLocation(program, 'uPalette'),
  };

  const reduced = prefersReducedMotion();
  const narrow = window.matchMedia('(max-width: 720px)').matches;
  const dprCap = narrow ? 1.5 : 2;

  let controls: Controls = getControls();
  const unsubscribeControls = subscribeControls((next) => {
    controls = next;
  });

  let cssWidth = canvas.clientWidth || window.innerWidth;
  let cssHeight = canvas.clientHeight || window.innerHeight;

  const resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (!rect) return;
    cssWidth = rect.width;
    cssHeight = rect.height;
  });
  resizeObserver.observe(canvas);

  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const min = Math.min(rect.width, rect.height) || 1;
    pointer.targetX = (event.clientX - rect.left - rect.width / 2) / min;
    pointer.targetY = -(event.clientY - rect.top - rect.height / 2) / min;
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  let quality = 1;
  let frameEma = 16.7;
  let sampledFrames = 0;
  let stableChecks = 0;
  let elapsed = 0;
  let progress = readTargetProgress();
  let reflected = -1;
  let last = performance.now();
  let rafId = 0;
  let disposed = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function render() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniforms.res, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, elapsed);
    gl.uniform1f(uniforms.progress, progress);
    gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
    gl.uniform1f(uniforms.quality, quality);
    gl.uniform1f(uniforms.scale, controls.scale);
    gl.uniform1f(uniforms.speed, controls.speed);
    gl.uniform1f(uniforms.contrast, controls.contrast);
    gl.uniform1i(uniforms.palette, controls.palette);
    drawFullscreen(gl);
  }

  function frame(now: number) {
    if (disposed) return;
    rafId = requestAnimationFrame(frame);

    const delta = Math.min(now - last, 50);
    last = now;

    if (document.hidden) return;

    resize();

    const target = readTargetProgress();
    progress += (target - progress) * (reduced ? 1 : 0.09);
    if (Math.abs(target - progress) < 0.0004) progress = target;

    const ease = reduced ? 1 : 0.06;
    pointer.x += (pointer.targetX - pointer.x) * ease;
    pointer.y += (pointer.targetY - pointer.y) * ease;

    if (!reduced) elapsed += delta / 1000;

    frameEma = frameEma * 0.9 + delta * 0.1;
    sampledFrames += 1;
    if (sampledFrames >= 45) {
      sampledFrames = 0;
      if (frameEma > SLOW_FRAME_MS && quality > MIN_QUALITY) {
        quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
        stableChecks = 0;
      } else if (frameEma < FAST_FRAME_MS) {
        stableChecks += 1;
        if (stableChecks >= 4 && quality < 1) {
          quality = Math.min(1, quality + QUALITY_STEP);
          stableChecks = 0;
        }
      } else {
        stableChecks = 0;
      }
    }

    render();

    if (Math.abs(progress - reflected) > 0.0008) {
      reflected = progress;
      reflectProgress(progress);
    }
  }

  rafId = requestAnimationFrame(frame);

  return {
    capture() {
      // Renderujemy klatkę i przechwytujemy ją w tym samym zadaniu, dzięki czemu
      // nie potrzebujemy preserveDrawingBuffer (który kosztuje wydajność).
      render();
      return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      unsubscribeControls();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
