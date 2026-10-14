import { Injectable } from '@angular/core';
import { APP_CONFIG } from './config';
import { LatLng, LocationSuggestion } from './models';
import { GeocodingProvider } from './providers';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** Common local shorthand whose corresponding OSM area is not consistently searchable. */
const KNOWN_AREAS: Record<string, LocationSuggestion> = {
  bgc: {
    id: 'known:bgc',
    label: 'Bonifacio Global City · Taguig',
    location: { lat: 14.5508, lng: 121.0509 },
  },
  'bonifacio global city': {
    id: 'known:bgc',
    label: 'Bonifacio Global City · Taguig',
    location: { lat: 14.5508, lng: 121.0509 },
  },
};

/**
 * A small, submit-only landmark lookup using the same public Overpass instances
 * already used for restaurants. This avoids a browser-incompatible public autocomplete API.
 */
@Injectable()
export class OverpassGeocodingProvider extends GeocodingProvider {
  private readonly cache = new Map<string, LocationSuggestion[]>();

  async search(query: string, bias: LatLng, signal?: AbortSignal): Promise<LocationSuggestion[]> {
    const normalized = query.trim().replace(/\s+/g, ' ');
    if (normalized.length < 3) return [];
    const key = `${normalized.toLocaleLowerCase()}@${bias.lat.toFixed(2)},${bias.lng.toFixed(2)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const known = KNOWN_AREAS[normalized.toLocaleLowerCase()];
    if (known) {
      this.cache.set(key, [known]);
      return [known];
    }
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const around = `around:100000,${bias.lat.toFixed(5)},${bias.lng.toFixed(5)}`;
    const data =
      `[out:json][timeout:10];(` +
      `nwr(${around})[place~"^(city|town|village|suburb|neighbourhood|quarter)$"][name~"${escaped}",i];` +
      `nwr(${around})[tourism~"^(attraction|museum|zoo|theme_park)$"][name~"${escaped}",i];` +
      `nwr(${around})[amenity~"^(marketplace|university|hospital|bus_station)$"][name~"${escaped}",i];` +
      `);out center tags 5;`;

    let lastError: unknown;
    for (const endpoint of APP_CONFIG.overpassEndpoints) {
      try {
        const timeout = AbortSignal.timeout(APP_CONFIG.requestTimeoutMs);
        const response = await fetch(endpoint, {
          method: 'POST',
          body: new URLSearchParams({ data }),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        if (!response.ok) throw new Error(`Overpass responded with ${response.status}`);
        const payload = (await response.json()) as { elements?: OverpassElement[] };
        const results = (payload.elements ?? []).map(normalize).filter(isSuggestion).slice(0, 5);
        this.cache.set(key, results);
        if (this.cache.size > 50) this.cache.delete(this.cache.keys().next().value!);
        return results;
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }
}

function normalize(element: OverpassElement): LocationSuggestion | null {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  const tags = element.tags ?? {};
  const name = tags['name:en'] || tags['name'];
  if (lat === undefined || lng === undefined || !name) return null;
  const type = tags['place'] || tags['tourism'] || tags['amenity'];
  const context = [tags['addr:city'], tags['addr:state'], tags['addr:country']].filter(Boolean).join(', ');
  return {
    id: `${element.type}/${element.id}`,
    label: [name, type, context].filter(Boolean).join(' · '),
    location: { lat, lng },
  };
}

function isSuggestion(value: LocationSuggestion | null): value is LocationSuggestion {
  return value !== null;
}
