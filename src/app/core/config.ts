import { LatLng } from './models';

/** Endpoints and limits for the free public services. Swap these if usage grows. */
export const APP_CONFIG = {
  /** Map start position before the user shares a location or moves the pin. */
  defaultCenter: { lat: 14.5547, lng: 121.0244 } as LatLng,
  defaultZoom: 15,
  mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  /** Tried in order; the next one is used only when the previous fails. */
  overpassEndpoints: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
  ],
  /**
   * City-level lookups by IP address, used only when the device cannot provide a
   * location. Each must return JSON with `latitude` and `longitude`.
   */
  ipLocationEndpoints: ['https://get.geojs.io/v1/ip/geo.json', 'https://ipwho.is/'],
  /** OSRM-compatible routing servers per travel mode (FOSSGIS community service). */
  routingEndpoints: {
    walk: 'https://routing.openstreetmap.de/routed-foot/route/v1/driving',
    drive: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  },
  overpassTimeoutS: 15,
  requestTimeoutMs: 25000,
  /** Overpass returns an arbitrary subset beyond this, so the UI flags truncation. */
  maxResults: 1000,
  /** Cards rendered per page, and how many results get a numbered, labelled map pin. */
  pageSize: 30,
  cacheTtlMs: 10 * 60 * 1000,
  radiusOptionsM: [500, 1000, 2000, 3000],
  defaultRadiusM: 1000,
};
