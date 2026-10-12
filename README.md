# Crave — food nearby

Browse restaurants, cafés and fast-food places around you, filter by craving, save favorites and
hand off to a maps app for directions. Anonymous, no backend, no API keys: everything the user
tunes lives in `localStorage` on their device.

Ratings and reviews are deliberately absent — the data source (OpenStreetMap) has no trustworthy
review feed, and the OSM `stars` tag is ignored.

## Run it

```bash
npm install
npm start        # http://localhost:4200
npm test         # unit tests (Vitest)
npm run build    # production build with the service worker, in dist/food-finder
```

Requires Node 20.19+ (Angular 21). Geolocation needs HTTPS or `localhost`. The service worker is
only active in production builds.

## Stack

| Layer      | Choice                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------- |
| App        | Angular 21, standalone components, signals, router                                              |
| UI         | Custom CSS following the `crave` prototype; Angular Material for icons, snack bar, progress bar |
| Map        | MapLibre GL JS + OpenFreeMap vector tiles                                                       |
| Places     | OpenStreetMap via the public Overpass API                                                       |
| Directions | Links out to Google Maps, Apple Maps or OpenStreetMap                                           |
| PWA        | `@angular/service-worker` (app shell only; results and tiles are not cached)                    |

## Layout

- `src/app/core/` — models, config, ranking, opening-hours parsing, stores and services.
  - `providers.ts` defines `RestaurantProvider`, `MapProvider`, `DirectionsProvider` and `RouteProvider`; the
    implementations are bound in `app.config.ts`, so a data source can be swapped in one place.
  - `config.ts` holds endpoints, default map centre, radius options and limits.
- `src/styles.css` — the colour palette as CSS variables (the map's copies are in
  `src/app/core/theme.ts`).
- `src/app/explore/` — the Discover page (search, chips, list, map).
- `src/app/saved/` — favorites and places hidden with “Not for me”.
- `src/app/shared/` — map view, place card, detail dialog, preference chips.

## Location

The app asks for the device location when it opens. If the device can't provide one it reopens the
last searched spot (stored locally) or, failing that, estimates a city-level position from the
visitor's IP address using the services in `ipLocationEndpoints` (`config.ts`). The IP lookup is
skipped when the user has blocked location for the site. Empty that list to disable it.

## How results are ordered

Selected cravings filter the list; the rest is distance from the search pin, with places that share
a cuisine with something you saved treated as 20% closer. Each card says why it is listed. “Hide
closed” only removes places whose mapped hours say they are closed — unknown hours stay, flagged.

## Free-service limits

OpenFreeMap and the public Overpass instances are shared community services with no uptime
guarantee; Overpass in particular can take many seconds or return 504 when busy. The app tries a
second mirror, times out, shows a retry state, caches each search for 10 minutes and only queries
when the user asks (“Search here”), never on every map move. If usage grows, point `config.ts` at a
hosted or self-hosted provider. Keep the OpenStreetMap attribution visible.
