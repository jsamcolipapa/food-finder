import { OverpassGeocodingProvider } from './overpass-geocoding.provider';

describe('OverpassGeocodingProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('expands BGC locally because its OSM area is not consistently searchable', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const results = await new OverpassGeocodingProvider().search('BGC', { lat: 14.55, lng: 121.04 });

    expect(results).toEqual([
      {
        id: 'known:bgc',
        label: 'Bonifacio Global City · Taguig',
        location: { lat: 14.5508, lng: 121.0509 },
      },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not request short input and reuses cached results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OverpassGeocodingProvider();

    await expect(provider.search('hi', { lat: 0, lng: 0 })).resolves.toEqual([]);
    await provider.search('Makati', { lat: 14.55, lng: 121.04 });
    await provider.search(' makati ', { lat: 14.55, lng: 121.04 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
