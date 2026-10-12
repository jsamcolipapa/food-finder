export interface LatLng {
  lat: number;
  lng: number;
}

/** Circular search area. Kept small on purpose: public Overpass instances are shared. */
export interface SearchArea {
  center: LatLng;
  radiusM: number;
}

export type OpenStatus = 'open' | 'closed' | 'unknown';

/** A normalized, OSM-sourced eatery. Ratings and reviews are deliberately not modelled. */
export interface Place {
  /** OSM element reference, e.g. `node/123`. */
  id: string;
  name: string;
  /** False when the mapped element has no name tag and `name` is a fallback label. */
  named: boolean;
  location: LatLng;
  /** OSM `amenity` value: restaurant, cafe, fast_food or food_court. */
  kind: string;
  /** Lower-cased `cuisine` values; empty when contributors did not map any. */
  cuisines: string[];
  vegetarian: boolean;
  openingHours?: string;
  address?: string;
  phone?: string;
  website?: string;
  /** Link to the element on openstreetmap.org so users can inspect or fix the data. */
  sourceUrl: string;
}

export interface Preference {
  id: string;
  label: string;
  /** Lower-cased terms matched against cuisine tags and, for custom chips, the name. */
  keywords: string[];
  custom: boolean;
}

export interface RankedPlace {
  place: Place;
  distanceM: number;
  status: OpenStatus;
  /** Labels of the selected preferences this place matches. */
  matches: string[];
  similarToSaved: boolean;
  /** Human-readable explanation of why the place is listed where it is. */
  reason: string;
}
