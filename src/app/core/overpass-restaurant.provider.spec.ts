import { buildQuery, normalizeElement } from './overpass-restaurant.provider';

describe('normalizeElement', () => {
  it('maps tags to a place and never exposes ratings', () => {
    const place = normalizeElement({
      type: 'node',
      id: 42,
      lat: 14.5,
      lon: 121,
      tags: {
        amenity: 'restaurant',
        name: 'Manam',
        cuisine: 'Filipino; Asian',
        stars: '5',
        opening_hours: 'Mo-Su 10:00-22:00',
        'addr:housenumber': '12',
        'addr:street': 'Ayala Ave',
        'addr:city': 'Makati',
        'diet:vegetarian': 'yes',
      },
    });
    expect(place).toMatchObject({
      id: 'node/42',
      name: 'Manam',
      named: true,
      cuisines: ['filipino', 'asian'],
      vegetarian: true,
      address: '12 Ayala Ave, Makati',
      sourceUrl: 'https://www.openstreetmap.org/node/42',
    });
    expect(JSON.stringify(place)).not.toContain('stars');
  });

  it('uses the centre of ways and labels unnamed places', () => {
    const place = normalizeElement({
      type: 'way',
      id: 7,
      center: { lat: 1, lon: 2 },
      tags: { amenity: 'cafe' },
    });
    expect(place).toMatchObject({
      name: 'Unnamed café',
      named: false,
      location: { lat: 1, lng: 2 },
    });
  });

  it('maps practical tags to features, ignoring anything short of a clear yes', () => {
    const features = (tags: Record<string, string>) =>
      normalizeElement({ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'cafe', ...tags } })
        ?.features;
    expect(
      features({ takeaway: 'yes', delivery: 'only', outdoor_seating: 'yes', wheelchair: 'yes' }),
    ).toEqual(['takeaway', 'delivery', 'outdoor', 'wheelchair']);
    expect(features({ takeaway: 'no', wheelchair: 'limited' })).toEqual([]);
    expect(features({})).toEqual([]);
  });

  it('skips elements without coordinates', () => {
    expect(normalizeElement({ type: 'relation', id: 1, tags: { amenity: 'cafe' } })).toBeNull();
  });
});

describe('buildQuery', () => {
  it('asks only for eateries inside the search radius', () => {
    const query = buildQuery({ center: { lat: 14.5547, lng: 121.0244 }, radiusM: 1000 });
    expect(query).toContain('around:1000,14.55470,121.02440');
    expect(query).toContain('restaurant|cafe|fast_food|food_court');
  });
});
