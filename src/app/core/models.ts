export interface LatLng {
  lat: number;
  lng: number;
}

/** A selectable city, address, neighbourhood, or landmark returned by a geocoder. */
export interface LocationSuggestion {
  id: string;
  label: string;
  location: LatLng;
}

/** Circular search area. Kept small on purpose: public Overpass instances are shared. */
export interface SearchArea {
  center: LatLng;
  radiusM: number;
}

export type OpenStatus = 'open' | 'closed' | 'unknown';

/** Practical details contributors sometimes map; absent means unknown, not "no". */
export type PlaceFeature = 'takeaway' | 'delivery' | 'outdoor' | 'wheelchair';

export const FEATURE_LABELS: Record<PlaceFeature, string> = {
  takeaway: 'Takeaway',
  delivery: 'Delivery',
  outdoor: 'Outdoor seating',
  wheelchair: 'Wheelchair accessible',
};

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
  features: PlaceFeature[];
  openingHours?: string;
  address?: string;
  phone?: string;
  website?: string;
  /** A Wikimedia Commons file explicitly linked by the OSM contributor, e.g. `File:Place.jpg`. */
  commonsFile?: string;
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

export type TravelMode = 'walk' | 'drive';

/** A path between two points, for drawing on the map. */
export interface Route {
  /** `[lng, lat]` pairs along the path, in GeoJSON order. */
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
}
