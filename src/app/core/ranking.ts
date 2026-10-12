import { distanceM, formatDistance } from './geo';
import { LatLng, Place, PlaceFeature, Preference, RankedPlace } from './models';
import { openStatus } from './opening-hours';

/** How much closer a place is treated when it resembles something the user saved. */
const SIMILAR_TO_SAVED_FACTOR = 0.8;

export interface RankOptions {
  origin: LatLng;
  selected: Preference[];
  favorites: Place[];
  hiddenIds: ReadonlySet<string>;
  openNowOnly: boolean;
  /** Only places mapped with every one of these features are kept. */
  features?: PlaceFeature[];
  /** Free-text search over name, cuisine and type. */
  query?: string;
  now?: Date;
}

export function matchesPreference(place: Place, pref: Preference): boolean {
  if (pref.id === 'cafe' && place.kind === 'cafe') {
    return true;
  }
  if (pref.id === 'vegetarian' && place.vegetarian) {
    return true;
  }
  const name = place.name.toLowerCase();
  return pref.keywords.some(
    (keyword) =>
      place.cuisines.some((c) => c.includes(keyword)) ||
      // Custom cravings are free text, so also look at the name ("ramen", "lugaw").
      (pref.custom && place.named && name.includes(keyword)),
  );
}

const EMOJI: [keyword: string, emoji: string][] = [
  ['ramen', '🍜'],
  ['noodle', '🍜'],
  ['sushi', '🍣'],
  ['japanese', '🍣'],
  ['korean', '🥘'],
  ['filipino', '🍲'],
  ['burger', '🍔'],
  ['pizza', '🍕'],
  ['chicken', '🍗'],
  ['bubble_tea', '🧋'],
  ['coffee', '☕'],
  ['vegetarian', '🥬'],
  ['vegan', '🥬'],
  ['chinese', '🥡'],
  ['ice_cream', '🍨'],
  ['dessert', '🍰'],
  ['donut', '🍩'],
  ['bakery', '🥐'],
  ['mexican', '🌮'],
  ['indian', '🍛'],
  ['thai', '🍛'],
  ['seafood', '🦐'],
  ['steak', '🥩'],
  ['barbecue', '🍖'],
  ['sandwich', '🥪'],
];

/** Decorative tile for a listing; OSM has no photos to show. */
export function placeEmoji(place: Place): string {
  for (const [keyword, emoji] of EMOJI) {
    if (place.cuisines.some((c) => c.includes(keyword))) return emoji;
  }
  if (place.kind === 'cafe') return '☕';
  if (place.kind === 'fast_food') return '🍟';
  return place.vegetarian ? '🥬' : '🍽️';
}

export function describeKind(place: Place): string {
  if (place.cuisines.length) {
    return place.cuisines
      .slice(0, 2)
      .map((c) => c.replace(/_/g, ' '))
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
      .join(', ');
  }
  const kinds: Record<string, string> = {
    restaurant: 'Restaurant',
    cafe: 'Café',
    fast_food: 'Fast food',
    food_court: 'Food court',
  };
  return kinds[place.kind] ?? 'Eatery';
}

function searchText(place: Place): string {
  return `${place.name} ${place.cuisines.join(' ')} ${describeKind(place)} ${place.kind}`
    .replace(/_/g, ' ')
    .toLowerCase();
}

/**
 * Filters and orders places. The order depends only on cuisine match, distance and
 * what the user saved on this device — never on ratings or reviews.
 */
export function rankPlaces(places: Place[], options: RankOptions): RankedPlace[] {
  const { origin, selected, favorites, hiddenIds, openNowOnly, now } = options;
  const query = options.query?.trim().toLowerCase();
  const savedIds = new Set(favorites.map((f) => f.id));
  const savedCuisines = new Set(favorites.flatMap((f) => f.cuisines));

  const ranked: RankedPlace[] = [];
  for (const place of places) {
    if (hiddenIds.has(place.id)) continue;
    if (query && !searchText(place).includes(query)) continue;
    if (options.features?.some((f) => !place.features.includes(f))) continue;

    const matches = selected.filter((p) => matchesPreference(place, p)).map((p) => p.label);
    if (selected.length && !matches.length) continue;

    const status = openStatus(place.openingHours, now);
    // Unknown hours stay in the list (flagged) — only places known to be closed drop out.
    if (openNowOnly && status === 'closed') continue;

    const distance = distanceM(origin, place.location);
    const similarToSaved =
      !savedIds.has(place.id) && place.cuisines.some((c) => savedCuisines.has(c));

    const parts = [matches.length ? `${matches.join(' + ')} match` : describeKind(place)];
    parts.push(`${formatDistance(distance)} away`);
    if (similarToSaved) parts.push('similar to places you saved');

    ranked.push({
      place,
      distanceM: distance,
      status,
      matches,
      similarToSaved,
      reason: parts.join(' · '),
    });
  }

  const score = (r: RankedPlace) => r.distanceM * (r.similarToSaved ? SIMILAR_TO_SAVED_FACTOR : 1);
  return ranked.sort((a, b) => score(a) - score(b));
}

/**
 * Chooses a place for the user: at random among those known to be open, falling back to
 * places with unknown hours. Known-closed places are never picked. Returns null when
 * nothing outside `excludeIds` qualifies.
 */
export function pickPlace(
  results: RankedPlace[],
  excludeIds: ReadonlySet<string>,
  random: () => number = Math.random,
): RankedPlace | null {
  const candidates = results.filter((r) => !excludeIds.has(r.place.id));
  const open = candidates.filter((r) => r.status === 'open');
  const pool = open.length ? open : candidates.filter((r) => r.status === 'unknown');
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}
