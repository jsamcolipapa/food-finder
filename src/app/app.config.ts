import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { ExternalDirectionsProvider } from './core/external-directions.provider';
import { OverpassGeocodingProvider } from './core/overpass-geocoding.provider';
import { OpenFreeMapProvider } from './core/openfreemap.provider';
import { OverpassRestaurantProvider } from './core/overpass-restaurant.provider';
import { OsrmRouteProvider } from './core/osrm-route.provider';
import {
  DirectionsProvider,
  GeocodingProvider,
  MapProvider,
  RestaurantProvider,
  RouteProvider,
} from './core/providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // Data, map and directions sources are swappable here.
    { provide: RestaurantProvider, useClass: OverpassRestaurantProvider },
    { provide: GeocodingProvider, useClass: OverpassGeocodingProvider },
    { provide: MapProvider, useClass: OpenFreeMapProvider },
    { provide: DirectionsProvider, useClass: ExternalDirectionsProvider },
    { provide: RouteProvider, useClass: OsrmRouteProvider },
  ],
};
