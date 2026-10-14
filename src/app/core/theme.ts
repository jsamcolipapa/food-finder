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
  pin: '#f43b5b',
  pinSaved: '#19232d',
  onPin: '#ffffff',
  onPinSaved: '#ffffff',
  label: '#d92a49',
  route: '#2f6fdb',
  halo: '#ffffff',
};

const DARK: MapColors = {
  pin: '#fa3d5e',
  pinSaved: '#f5f8fa',
  onPin: '#ffffff',
  onPinSaved: '#2a211c',
  label: '#ff9aaa',
  route: '#6ea0f5',
  halo: '#101820',
};

export function mapColors(dark: boolean): MapColors {
  return dark ? DARK : LIGHT;
}

/** --paper in each theme, for the browser chrome. */
export const PAGE_COLORS = { light: '#f4f6f8', dark: '#101820' };
