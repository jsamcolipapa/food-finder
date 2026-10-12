import { Injectable, computed, inject, signal } from '@angular/core';
import { APP_CONFIG } from './config';
import { LocationService } from './location.service';
import { LatLng, Place, SearchArea } from './models';
import { PreferencesService } from './preferences.service';
import { RestaurantProvider } from './providers';
import { StorageService } from './storage.service';
import { rankPlaces } from './ranking';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';
/** How the current search centre was chosen when the device gave no position. */
export type Fallback = 'last-search' | 'ip' | null;

/** Search state shared by the explore and saved pages. */
@Injectable({ providedIn: 'root' })
export class ExploreStore {
  private readonly provider = inject(RestaurantProvider);
  private readonly prefs = inject(PreferencesService);
  private readonly location = inject(LocationService);
  private readonly storage = inject(StorageService);
  private pending?: AbortController;

  /** Where the map is currently centred (the pin). */
  readonly mapCenter = signal<LatLng>(APP_CONFIG.defaultCenter);
  /** The area the listed results were fetched for. */
  readonly searched = signal<SearchArea | null>(null);
  readonly places = signal<Place[]>([]);
  readonly loadState = signal<LoadState>('idle');
  readonly selectedId = signal<string | null>(null);
  readonly online = signal(navigator.onLine);
  readonly query = signal('');
  readonly fallback = signal<Fallback>(null);

  /** Dense areas can exceed the provider's cap, in which case the list is partial. */
  readonly truncated = computed(() => this.places().length >= APP_CONFIG.maxResults);

  readonly results = computed(() => {
    const area = this.searched();
    if (!area) return [];
    return rankPlaces(this.places(), {
      origin: area.center,
      selected: this.prefs.selected(),
      favorites: this.prefs.favorites(),
      hiddenIds: this.prefs.hiddenIds(),
      openNowOnly: this.prefs.openNowOnly(),
      query: this.query(),
    });
  });

  readonly selected = computed(
    () => this.results().find((r) => r.place.id === this.selectedId()) ?? null,
  );

  /** True when the pin moved far enough that the list no longer describes it. */
  readonly pinMoved = computed(() => {
    const area = this.searched();
    if (!area) return false;
    const c = this.mapCenter();
    return (
      Math.abs(c.lat - area.center.lat) > 0.001 ||
      Math.abs(c.lng - area.center.lng) > 0.001 ||
      area.radiusM !== this.prefs.radiusM()
    );
  });

  constructor() {
    addEventListener('online', () => this.online.set(true));
    addEventListener('offline', () => this.online.set(false));
  }

  private autoLocated = false;

  /** Asks for the device location once per visit, as soon as the app opens. */
  locateOnStart(): void {
    if (this.autoLocated) return;
    this.autoLocated = true;
    void this.useMyLocation();
  }

  async useMyLocation(): Promise<void> {
    this.fallback.set(null);
    const position = await this.location.request();
    if (position) {
      this.mapCenter.set(position);
      await this.search(position);
      return;
    }

    // No device position: reopen where the user last searched, and only if there is no
    // such place — and they did not refuse location outright — estimate from the network.
    let center = this.storage.read<LatLng | null>('lastCenter', null);
    let source: Fallback = 'last-search';
    if (!center && this.location.state() === 'unavailable') {
      center = await this.location.approximate();
      source = 'ip';
    }
    if (center) {
      this.fallback.set(source);
      this.mapCenter.set(center);
      await this.search(center);
    }
  }

  async search(center: LatLng = this.mapCenter()): Promise<void> {
    this.pending?.abort();
    const controller = (this.pending = new AbortController());
    const area: SearchArea = { center, radiusM: this.prefs.radiusM() };
    this.loadState.set('loading');
    this.selectedId.set(null);
    try {
      const places = await this.provider.searchNearby(area, controller.signal);
      if (controller.signal.aborted) return;
      this.places.set(places);
      this.searched.set(area);
      this.storage.write('lastCenter', center);
      this.loadState.set('ready');
    } catch {
      if (controller.signal.aborted) return;
      this.loadState.set('error');
    }
  }
}
