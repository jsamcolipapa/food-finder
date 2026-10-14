import { CommonsPhotoService } from './commons-photo.service';

function page(title: string, overrides: Record<string, unknown> = {}) {
  return {
    title,
    imageinfo: [
      {
        thumburl: 'https://upload.wikimedia.org/example/thumb.jpg',
        descriptionurl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
        thumbmime: 'image/jpeg',
        extmetadata: {
          Artist: { value: '<b>Ada Photographer</b>' },
          LicenseShortName: { value: 'CC BY-SA 4.0' },
        },
        ...overrides,
      },
    ],
  };
}

async function waitForPhoto(read: () => unknown): Promise<void> {
  await vi.waitFor(() => expect(read()).not.toBeUndefined());
}

describe('CommonsPhotoService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('deduplicates requests and exposes a safe, attributed Commons thumbnail', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ query: { pages: { '1': page('File:Coffee shop.jpg') } } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = new CommonsPhotoService();

    const first = service.photoFor('File:Coffee shop.jpg');
    const duplicate = service.photoFor('File:Coffee shop.jpg');
    await waitForPhoto(first);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(duplicate()).toEqual(first());
    expect(first()).toMatchObject({ creator: 'Ada Photographer', license: 'CC BY-SA 4.0' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('origin=*');
  });

  it('batches at most ten files per request', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      const titles = new URL(url).searchParams.get('titles')!.split('|');
      return {
        ok: true,
        json: async () => ({
          query: { pages: Object.fromEntries(titles.map((title, index) => [index, page(title)])) },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const service = new CommonsPhotoService();
    const photos = Array.from({ length: 11 }, (_, index) => service.photoFor(`File:${index}.jpg`));

    await waitForPhoto(photos[10]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('titles')!.split('|')).toHaveLength(10);
    expect(photos.every((photo) => photo()?.thumbnailUrl)).toBe(true);
  });

  it('falls back for missing, non-raster, or failed requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: { '1': page('File:Logo.svg', { thumbmime: 'image/svg+xml' }) } },
        }),
      })
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const service = new CommonsPhotoService();
    const svg = service.photoFor('File:Logo.svg');
    await waitForPhoto(svg);
    const offline = service.photoFor('File:Offline.jpg');
    await waitForPhoto(offline);

    expect(svg()).toBeNull();
    expect(offline()).toBeNull();
  });
});
