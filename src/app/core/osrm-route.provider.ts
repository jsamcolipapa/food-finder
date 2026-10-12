import { Injectable } from '@angular/core';
import { APP_CONFIG } from './config';
import { LatLng, Route, TravelMode } from './models';
import { RouteProvider } from './providers';

interface OsrmResponse {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
  }[];
}

export function buildRouteUrl(origin: LatLng, destination: LatLng, mode: TravelMode): string {
  const point = (p: LatLng) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
  return (
    `${APP_CONFIG.routingEndpoints[mode]}/${point(origin)};${point(destination)}` +
    '?overview=full&geometries=geojson'
  );
}

@Injectable()
export class OsrmRouteProvider extends RouteProvider {
  async route(
    origin: LatLng,
    destination: LatLng,
    mode: TravelMode,
    signal?: AbortSignal,
  ): Promise<Route> {
    const timeout = AbortSignal.timeout(APP_CONFIG.requestTimeoutMs);
    const response = await fetch(buildRouteUrl(origin, destination, mode), {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    const json = (await response.json()) as OsrmResponse;
    const best = json.routes?.[0];
    if (!response.ok || json.code !== 'Ok' || !best) {
      throw new Error(`Routing failed: ${json.code ?? response.status}`);
    }
    return {
      coordinates: best.geometry.coordinates,
      distanceM: best.distance,
      durationS: best.duration,
    };
  }
}
