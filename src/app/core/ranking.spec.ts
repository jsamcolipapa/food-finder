import { Place, Preference } from './models';
import { pickPlace, rankPlaces } from './ranking';

const origin = { lat: 14.55, lng: 121.02 };

function place(id: string, overrides: Partial<Place> = {}): Place {
  return {
    id,
    name: id,
    named: true,
    location: origin,
    kind: 'restaurant',
    cuisines: [],
    vegetarian: false,
    features: [],
    sourceUrl: `https://www.openstreetmap.org/${id}`,
    ...overrides,
  };
}

const north = (meters: number) => ({ lat: origin.lat + meters / 111320, lng: origin.lng });
const japanese: Preference = {
  id: 'japanese',
  label: 'Japanese',
  keywords: ['japanese', 'sushi', 'ramen'],
  custom: false,
};
const base = {
  origin,
  selected: [],
  favorites: [],
  hiddenIds: new Set<string>(),
  openNowOnly: false,
};

describe('rankPlaces', () => {
  it('orders by distance and explains each result', () => {
    const ranked = rankPlaces(
      [place('far', { location: north(900) }), place('near', { location: north(100) })],
      base,
    );
    expect(ranked.map((r) => r.place.id)).toEqual(['near', 'far']);
    expect(ranked[1].reason).toBe('Restaurant · 900 m away');
  });

  it('keeps only places matching a selected preference', () => {
    const ranked = rankPlaces(
      [
        place('sushi', { cuisines: ['sushi'] }),
        place('pizza', { cuisines: ['pizza'] }),
        place('?'),
      ],
      { ...base, selected: [japanese] },
    );
    expect(ranked.map((r) => r.place.id)).toEqual(['sushi']);
    expect(ranked[0].reason).toContain('Japanese match');
  });

  it('matches custom cravings against the name as well as cuisine tags', () => {
    const lugaw: Preference = {
      id: 'custom:lugaw',
      label: 'Lugaw',
      keywords: ['lugaw'],
      custom: true,
    };
    const ranked = rankPlaces([place('a', { name: 'Lugaw Republic' }), place('b')], {
      ...base,
      selected: [lugaw],
    });
    expect(ranked.map((r) => r.place.id)).toEqual(['a']);
  });

  it('treats cafés and vegetarian-friendly places as matches for those chips', () => {
    const cafe: Preference = { id: 'cafe', label: 'Café', keywords: ['coffee'], custom: false };
    const veg: Preference = {
      id: 'vegetarian',
      label: 'Vegetarian',
      keywords: ['vegan'],
      custom: false,
    };
    const places = [place('c', { kind: 'cafe' }), place('v', { vegetarian: true }), place('x')];
    expect(rankPlaces(places, { ...base, selected: [cafe] }).map((r) => r.place.id)).toEqual(['c']);
    expect(rankPlaces(places, { ...base, selected: [veg] }).map((r) => r.place.id)).toEqual(['v']);
  });

  it('nudges places that resemble saved ones ahead of slightly closer ones', () => {
    const ranked = rankPlaces(
      [
        place('closer', { location: north(450), cuisines: ['pizza'] }),
        place('similar', { location: north(500), cuisines: ['korean'] }),
      ],
      { ...base, favorites: [place('fav', { cuisines: ['korean'] })] },
    );
    expect(ranked.map((r) => r.place.id)).toEqual(['similar', 'closer']);
    expect(ranked[0].reason).toContain('similar to places you saved');
  });

  it('drops hidden places, and known-closed ones only when asked', () => {
    const now = new Date('2026-10-12T12:00:00');
    const places = [
      place('hidden'),
      place('closed', { openingHours: 'Mo off' }),
      place('unknown'),
      place('open', { openingHours: '24/7' }),
    ];
    const options = { ...base, hiddenIds: new Set(['hidden']), now };
    expect(rankPlaces(places, options)).toHaveLength(3);
    const openOnly = rankPlaces(places, { ...options, openNowOnly: true });
    expect(openOnly.map((r) => r.place.id).sort()).toEqual(['open', 'unknown']);
  });
});

describe('rankPlaces text search', () => {
  it('matches the query against name and cuisine', () => {
    const places = [
      place('a', { name: 'Ramen Nagi', cuisines: ['ramen'] }),
      place('b', { name: 'Kanto', cuisines: ['filipino'] }),
    ];
    expect(rankPlaces(places, { ...base, query: ' RAMEN ' }).map((r) => r.place.id)).toEqual(['a']);
    expect(rankPlaces(places, { ...base, query: 'filip' }).map((r) => r.place.id)).toEqual(['b']);
  });
});

describe('rankPlaces feature filters', () => {
  it('keeps only places mapped with every selected feature', () => {
    const places = [
      place('both', { features: ['takeaway', 'delivery'] }),
      place('one', { features: ['takeaway'] }),
      place('none'),
    ];
    const ids = (features: ('takeaway' | 'delivery')[]) =>
      rankPlaces(places, { ...base, features })
        .map((r) => r.place.id)
        .sort();
    expect(ids(['takeaway'])).toEqual(['both', 'one']);
    expect(ids(['takeaway', 'delivery'])).toEqual(['both']);
    expect(ids([])).toEqual(['both', 'none', 'one']);
  });
});

describe('pickPlace', () => {
  const now = new Date('2026-10-12T12:00:00');
  const ranked = rankPlaces(
    [
      place('open-a', { openingHours: '24/7' }),
      place('open-b', { openingHours: '24/7' }),
      place('unknown'),
      place('closed', { openingHours: 'Mo off' }),
    ],
    { ...base, now },
  );
  const pick = (exclude: string[], random = 0) =>
    pickPlace(ranked, new Set(exclude), () => random)?.place.id ?? null;

  it('prefers places known to be open', () => {
    expect(['open-a', 'open-b']).toContain(pick([], 0));
    expect(['open-a', 'open-b']).toContain(pick([], 0.99));
    expect(pick([], 0)).not.toBe(pick([], 0.99));
  });

  it('skips places already offered, then falls back to unknown hours', () => {
    expect(pick(['open-a'])).toBe('open-b');
    expect(pick(['open-a', 'open-b'])).toBe('unknown');
  });

  it('never picks a place known to be closed', () => {
    expect(pick(['open-a', 'open-b', 'unknown'])).toBeNull();
  });
});
