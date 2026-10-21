/**
 * Stand-ins for `three/webgpu` and `three/tsl`, which three-globe imports only to
 * GPU-accelerate its heatmap layer. ATLAS RUSH renders with WebGL and never uses
 * heatmaps, so aliasing these keeps the WebGPU renderer (~0.5 MB) out of the bundle.
 */
class Unavailable {
  constructor() {
    throw new Error('WebGPU features are not available in this build')
  }
}
export const WebGPURenderer = Unavailable
export const StorageInstancedBufferAttribute = Unavailable
export default {}
