import { Injectable } from '@angular/core';
import { APP_CONFIG } from './config';
import { Place, SearchArea } from './models';
import { RestaurantProvider } from './providers';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const KIND_LABELS: Record<string, string> = {
  restaurant: 'Unnamed restaurant',
  cafe: 'Unnamed café',
  fast_food: 'Unnamed fast-food place',
  food_court: 'Unnamed food court',
};

/** Maps a raw Overpass element to a Place. The OSM `stars` tag is intentionally ignored. */
export function normalizeElement(el: OverpassElement): Place | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat === undefined || lng === undefined || !tags['amenity']) {
    return null;
  }
  const name = tags['name:en'] || tags['name'] || tags['brand'];
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const address = [street, tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', ');
  const isYes = (v?: string) => v === 'yes' || v === 'only';

  return {
    id: `${el.type}/${el.id}`,
    name: name ?? KIND_LABELS[tags['amenity']] ?? 'Unnamed place',
    named: !!name,
    location: { lat, lng },
    kind: tags['amenity'],
    cuisines: (tags['cuisine'] ?? '')
      .toLowerCase()
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean),
    vegetarian: isYes(tags['diet:vegetarian']) || isYes(tags['diet:vegan']),
    openingHours: tags['opening_hours'] || undefined,
    address: address || undefined,
    phone: tags['contact:phone'] || tags['phone'] || undefined,
    website: tags['contact:website'] || tags['website'] || undefined,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  };
}

export function buildQuery(area: SearchArea): string {
  const { lat, lng } = area.center;
  const around = `around:${Math.round(area.radiusM)},${lat.toFixed(5)},${lng.toFixed(5)}`;
  return (
    `[out:json][timeout:${APP_CONFIG.overpassTimeoutS}];` +
    `nwr(${around})[amenity~"^(restaurant|cafe|fast_food|food_court)$"];` +
    `out center tags ${APP_CONFIG.maxResults};`
  );
}

@Injectable()
export class OverpassRestaurantProvider extends RestaurantProvider {
  private readonly cache = new Map<string, { at: number; places: Place[] }>();

  async searchNearby(area: SearchArea, signal?: AbortSignal): Promise<Place[]> {
    // ~100 m grid so small pin nudges reuse the previous answer instead of re-querying.
    const key = `${area.center.lat.toFixed(3)},${area.center.lng.toFixed(3)},${area.radiusM}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < APP_CONFIG.cacheTtlMs) {
      return cached.places;
    }

    const body = new URLSearchParams({ data: buildQuery(area) });
    let lastError: unknown;
    for (const endpoint of APP_CONFIG.overpassEndpoints) {
      // Shared public instances sometimes accept a connection and never answer.
      const timeout = AbortSignal.timeout(APP_CONFIG.requestTimeoutMs);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body,
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        if (!response.ok) {
          throw new Error(`Overpass responded with ${response.status}`);
        }
        const json = (await response.json()) as { elements?: OverpassElement[] };
        const places = (json.elements ?? [])
          .map(normalizeElement)
          .filter((p): p is Place => p !== null);
        this.cache.set(key, { at: Date.now(), places });
        return places;
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }
}
