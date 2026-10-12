/**
 * Colours needed outside CSS. MapLibre paint properties and the theme-color meta tag
 * can't read CSS variables, so these mirror the palette in src/styles.css — change both
 * together.
 */
export interface MapColors {
  pin: string;
  /** Saved places stay distinct from ordinary pins. */
  pinSaved: string;
  /** Rank number drawn on a pin. */
  onPin: string;
  onPinSaved: string;
  label: string;
  route: string;
  /** Outline around pins, labels and the route so they separate from the base map. */
  halo: string;
}

const LIGHT: MapColors = {
  pin: '#d03e1a',
  pinSaved: '#2a211c',
  onPin: '#ffffff',
  onPinSaved: '#ffffff',
  label: '#b93414',
  route: '#2f6fdb',
  halo: '#ffffff',
};

const DARK: MapColors = {
  pin: '#d03e1a',
  pinSaved: '#f6ece4',
  onPin: '#ffffff',
  onPinSaved: '#2a211c',
  label: '#ffb59e',
  route: '#6ea0f5',
  halo: '#1c1512',
};

export function mapColors(dark: boolean): MapColors {
  return dark ? DARK : LIGHT;
}

/** --paper in each theme, for the browser chrome. */
export const PAGE_COLORS = { light: '#fff8ef', dark: '#1c1512' };
