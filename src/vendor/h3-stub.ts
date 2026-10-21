/**
 * Stand-in for `h3-js`, which three-globe imports only for its hexagon layers. ATLAS RUSH
 * never uses those layers, so aliasing h3-js to this stub (see vite.config.ts) removes
 * ~0.5 MB of Emscripten code from the bundle.
 */
const unsupported = (): never => {
  throw new Error('H3 hexagon layers are not available in this build')
}
export const latLngToCell = unsupported
export const cellToLatLng = unsupported
export const cellToBoundary = unsupported
export const polygonToCells = unsupported
