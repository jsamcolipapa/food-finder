import { Injectable, computed, inject, signal } from '@angular/core';
import { APP_CONFIG } from './config';
import { LocationService } from './location.service';
import { LatLng, Place, SearchArea } from './models';
import { PreferencesService } from './preferences.service';
import { RestaurantProvider } from './providers';
import { rankPlaces } from './ranking';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Search state shared by the explore and saved pages. */
@Injectable({ providedIn: 'root' })
export class ExploreStore {
  private readonly provider = inject(RestaurantProvider);
  private readonly prefs = inject(PreferencesService);
  private readonly location = inject(LocationService);
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

  async useMyLocation(): Promise<void> {
    const position = await this.location.request();
    if (position) {
      this.mapCenter.set(position);
      await this.search(position);
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
      this.loadState.set('ready');
    } catch {
      if (controller.signal.aborted) return;
      this.loadState.set('error');
    }
  }
}
