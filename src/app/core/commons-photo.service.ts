import { Injectable, Signal, WritableSignal, signal } from '@angular/core';

/** UI-only metadata returned by Wikimedia Commons for an OSM-linked file. */
export interface CommonsPhoto {
  thumbnailUrl: string;
  filePageUrl: string;
  creator?: string;
  license?: string;
}

type PhotoState = CommonsPhoto | null | undefined;

interface ImageInfo {
  thumburl?: string;
  descriptionurl?: string;
  mime?: string;
  thumbmime?: string;
  extmetadata?: Record<string, { value?: string }>;
}

interface CommonsPage {
  title?: string;
  missing?: boolean;
  imageinfo?: ImageInfo[];
}

interface CommonsResponse {
  query?: { pages?: Record<string, CommonsPage> };
}

const EMPTY_PHOTO = signal<PhotoState>(null).asReadonly();
const RASTER_MIME_TYPES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const BATCH_SIZE = 10;

/**
 * Resolves OSM's explicit `wikimedia_commons=File:…` tags in the browser.
 * Results are intentionally memory-only: users get fresh attribution on reload
 * and the app never stores remote media URLs in preferences.
 */
@Injectable({ providedIn: 'root' })
export class CommonsPhotoService {
  private readonly states = new Map<string, WritableSignal<PhotoState>>();
  private readonly queued = new Set<string>();
  private scheduled = false;

  photoFor(file?: string): Signal<PhotoState> {
    if (!file) return EMPTY_PHOTO;
    let state = this.states.get(file);
    if (!state) {
      state = signal<PhotoState>(undefined);
      this.states.set(file, state);
      this.queued.add(file);
      this.schedule();
    }
    return state.asReadonly();
  }

  /** An image-load error has the same safe result as a missing Commons file. */
  markUnavailable(file?: string): void {
    if (file) this.states.get(file)?.set(null);
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => void this.flush());
  }

  private async flush(): Promise<void> {
    this.scheduled = false;
    const files = [...this.queued].slice(0, BATCH_SIZE);
    files.forEach((file) => this.queued.delete(file));
    if (!files.length) return;

    try {
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        origin: '*',
        prop: 'imageinfo',
        titles: files.join('|'),
        iiprop: 'url|mime|thumbmime|extmetadata',
        iiurlwidth: '720',
        iiextmetadatalanguage: 'en',
        iiextmetadatafilter: 'Artist|Credit|LicenseShortName',
      });
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
      if (!response.ok) throw new Error(`Commons responded with ${response.status}`);
      const payload = (await response.json()) as CommonsResponse;
      const byTitle = new Map(
        Object.values(payload.query?.pages ?? {}).map((page) => [page.title, page]),
      );

      for (const file of files) {
        const page = byTitle.get(file);
        this.states.get(file)?.set(page ? toPhoto(page) : null);
      }
    } catch {
      // Photos are optional enhancement. A Commons outage must never affect discovery.
      files.forEach((file) => this.states.get(file)?.set(null));
    } finally {
      if (this.queued.size) this.schedule();
    }
  }
}

function toPhoto(page: CommonsPage): CommonsPhoto | null {
  if (page.missing) return null;
  const info = page.imageinfo?.[0];
  if (!info?.thumburl || !info.descriptionurl || !RASTER_MIME_TYPES.has(info.thumbmime ?? info.mime ?? '')) {
    return null;
  }
  try {
    const thumbnail = new URL(info.thumburl);
    const pageUrl = new URL(info.descriptionurl);
    if (
      thumbnail.protocol !== 'https:' ||
      thumbnail.hostname !== 'upload.wikimedia.org' ||
      pageUrl.protocol !== 'https:' ||
      pageUrl.hostname !== 'commons.wikimedia.org'
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    thumbnailUrl: info.thumburl,
    filePageUrl: info.descriptionurl,
    creator: textMetadata(info.extmetadata?.['Artist'] ?? info.extmetadata?.['Credit']),
    license: textMetadata(info.extmetadata?.['LicenseShortName']),
  };
}

function textMetadata(metadata?: { value?: string }): string | undefined {
  const value = metadata?.value?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return value || undefined;
}
