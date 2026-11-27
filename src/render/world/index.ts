// The world renderer entry (v1.6, Three.js). Loaded only through a dynamic `import()`, so `three` lands in its
// own lazily loaded chunk and the start screen never waits for it. `createWorldRenderer` arrives with task 11.8;
// until then the entry only exposes the classes it will be built on.
export { REVISION, Scene, WebGLRenderer } from 'three';
