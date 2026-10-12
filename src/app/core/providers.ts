import { LatLng, Place, SearchArea } from './models';

/** Source of nearby eateries. Swap the implementation to change data provider. */
export abstract class RestaurantProvider {
  abstract searchNearby(area: SearchArea, signal?: AbortSignal): Promise<Place[]>;
}

/** Owns the map style/tile configuration and the attribution that must stay visible. */
export abstract class MapProvider {
  abstract readonly styleUrl: string;
  abstract readonly attribution: { label: string; url: string }[];
}

export interface DirectionsLink {
  label: string;
  url: string;
}

/** Builds hand-off links to external navigation apps; no in-app routing. */
export abstract class DirectionsProvider {
  abstract createLinks(place: Place, origin?: LatLng): DirectionsLink[];
}
