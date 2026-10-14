import { APP_CONFIG } from './config';
import { LatLng, PlaceFeature } from './models';
import { BUILT_IN_PREFERENCES } from './preferences.service';

export interface SharedSearch {
  center: LatLng;
  radiusM: number;
  query: string;
  selectedIds: string[];
  openNowOnly: boolean;
  features: PlaceFeature[];
}

const FEATURE_VALUES: PlaceFeature[] = ['takeaway', 'delivery', 'outdoor', 'wheelchair'];
const BUILT_IN_IDS = new Set(BUILT_IN_PREFERENCES.map((preference) => preference.id));

/** Converts only portable, explicitly supported controls into a stable share URL query. */
export function serializeSharedSearch(search: SharedSearch): URLSearchParams {
  const params = new URLSearchParams({
    lat: search.center.lat.toFixed(5),
    lng: search.center.lng.toFixed(5),
    radius: String(search.radiusM),
  });
  if (search.query.trim()) params.set('q', search.query.trim().slice(0, 100));
  const selected = search.selectedIds.filter((id) => BUILT_IN_IDS.has(id));
  if (selected.length) params.set('cuisine', selected.join(','));
  if (search.openNowOnly) params.set('open', '1');
  const features = search.features.filter((feature) => FEATURE_VALUES.includes(feature));
  if (features.length) params.set('features', features.join(','));
  return params;
}

/** Invalid coordinates make the whole link unusable; unsupported filters are simply ignored. */
export function parseSharedSearch(params: Pick<URLSearchParams, 'get'>): SharedSearch | null {
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }
  const radius = Number(params.get('radius'));
  const radiusM = APP_CONFIG.radiusOptionsM.includes(radius) ? radius : APP_CONFIG.defaultRadiusM;
  const query = (params.get('q') ?? '').trim().slice(0, 100);
  const selectedIds = unique<string>(params.get('cuisine'), (value) => BUILT_IN_IDS.has(value));
  const features = unique<PlaceFeature>(params.get('features'), (value): value is PlaceFeature =>
    FEATURE_VALUES.includes(value as PlaceFeature),
  );
  return { center: { lat, lng }, radiusM, query, selectedIds, openNowOnly: params.get('open') === '1', features };
}

function unique<T extends string>(raw: string | null, valid: (value: string) => boolean): T[] {
  return [...new Set((raw ?? '').split(',').filter((value) => !!value && valid(value)))] as T[];
}
