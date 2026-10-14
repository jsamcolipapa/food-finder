import { parseSharedSearch, serializeSharedSearch } from './search-link';

describe('shared search links', () => {
  it('round-trips supported search controls and omits custom preferences', () => {
    const params = serializeSharedSearch({
      center: { lat: 14.55471, lng: 121.02442 },
      radiusM: 2000,
      query: ' ramen ',
      selectedIds: ['japanese', 'custom:ramen'],
      openNowOnly: true,
      features: ['takeaway', 'outdoor'],
    });

    expect(params.toString()).toContain('cuisine=japanese');
    expect(params.toString()).not.toContain('custom');
    expect(parseSharedSearch(params)).toEqual({
      center: { lat: 14.55471, lng: 121.02442 },
      radiusM: 2000,
      query: 'ramen',
      selectedIds: ['japanese'],
      openNowOnly: true,
      features: ['takeaway', 'outdoor'],
    });
  });

  it('rejects invalid locations and drops unsupported filters', () => {
    expect(parseSharedSearch(new URLSearchParams('lat=100&lng=121'))).toBeNull();
    expect(parseSharedSearch(new URLSearchParams('lat=14&lng=121&radius=9000&cuisine=unknown,japanese&features=bad,delivery&open=0'))).toEqual({
      center: { lat: 14, lng: 121 },
      radiusM: 1000,
      query: '',
      selectedIds: ['japanese'],
      openNowOnly: false,
      features: ['delivery'],
    });
  });
});
