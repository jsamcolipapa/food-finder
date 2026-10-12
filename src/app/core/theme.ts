/**
 * Colours used by the map. MapLibre paint properties can't read CSS variables, so
 * these mirror the palette in src/styles.css — change both together.
 */
export const MAP_COLORS = {
  /** --primary */
  pin: '#d03e1a',
  /** --ink: saved places stay distinct from ordinary pins. */
  pinSaved: '#2a211c',
  /** --primary-strong */
  label: '#b93414',
  route: '#2f6fdb',
  halo: '#ffffff',
};
