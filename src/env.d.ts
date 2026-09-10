/// <reference types="astro/client" />

declare module '*.glsl?raw' {
  const source: string;
  export default source;
}
