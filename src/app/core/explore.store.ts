import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { APP_CONFIG } from './config';
import { distanceM, progressAlong } from './geo';
import { LocationService } from './location.service';
import { LatLng, Place, Route, SearchArea, TravelMode } from './models';
import { PreferencesService } from './preferences.service';
import { RestaurantProvider, RouteProvider } from './providers';
import { StorageService } from './storage.service';
import { pickPlace, rankPlaces } from './ranking';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';
/** The path currently drawn on the map, or the attempt to fetch one. */
export interface ActiveRoute {
  place: Place;
  origin: LatLng;
  mode: TravelMode;
  state: 'loading' | 'ready' | 'error';
  route?: Route;
  /** True while the device position is being followed; false when starting from the pin. */
  live: boolean;
  /** Bumped when a route is first drawn or recalculated, so the map knows to re-frame it. */
  version: number;
  /** While live: the part of the path still ahead, and how far and long it is. */
  ahead?: [number, number][];
  remainingM?: number;
  remainingS?: number;
  arrived?: boolean;
}

/** How the current search centre was chosen when the device gave no position. */
export type Fallback = 'last-search' | 'ip' | null;

/** Search state shared by the explore and saved pages. */
@Injectable({ providedIn: 'root' })
export class ExploreStore {
  private readonly provider = inject(RestaurantProvider);
  private readonly prefs = inject(PreferencesService);
  private readonly location = inject(LocationService);
  private readonly storage = inject(StorageService);
  private readonly router = inject(RouteProvider);
  private pendingRoute?: AbortController;
  private routeVersion = 0;
  private offRouteFixes = 0;
  private lastRerouteAt = 0;
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
  readonly activeRoute = signal<ActiveRoute | null>(null);

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
      features: this.prefs.featureFilters(),
      query: this.query(),
    });
  });

  readonly selected = computed(
    () => this.results().find((r) => r.place.id === this.selectedId()) ?? null,
  );

  /** Places already offered by “Pick for me”, so repeats wait until the rest are used. */
  private offered = new Set<string>();
  private readonly pickedId = signal<string | null>(null);
  /** True while the open place was chosen by “Pick for me” rather than by the user. */
  readonly selectedWasPicked = computed(
    () => this.selectedId() !== null && this.selectedId() === this.pickedId(),
  );
  readonly canPick = computed(() => this.results().some((r) => r.status !== 'closed'));

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
    // Opening a place's details is what counts as having viewed it.
    effect(() => {
      const place = this.selected()?.place;
      if (place) untracked(() => this.prefs.recordView(place));
    });
    // Each new device position moves the user along the open route.
    effect(() => {
      const position = this.location.position();
      const accuracy = this.location.accuracyM();
      if (position) untracked(() => this.followRoute(position, accuracy));
    });
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

  /**
   * Draws a path to the place from the device position, or from the searched spot when
   * the device has not provided one. From a device position the route then follows the
   * user until it is cleared.
   */
  async showRoute(place: Place, mode: TravelMode = 'walk'): Promise<void> {
    this.pendingRoute?.abort();
    const controller = (this.pendingRoute = new AbortController());
    const device = this.location.position();
    const origin = device ?? this.searched()?.center ?? this.mapCenter();
    const base = { place, origin, mode, live: false, version: 0 };
    this.offRouteFixes = 0;
    this.selectedId.set(null);
    this.activeRoute.set({ ...base, state: 'loading' });
    try {
      const route = await this.router.route(origin, place.location, mode, controller.signal);
      if (controller.signal.aborted) return;
      this.activeRoute.set({
        ...base,
        state: 'ready',
        route,
        live: !!device,
        version: ++this.routeVersion,
      });
      if (device) this.location.watch();
    } catch {
      if (controller.signal.aborted) return;
      this.activeRoute.set({ ...base, state: 'error' });
    }
  }

  /** Updates the open route for a new device position: progress, arrival or re-route. */
  private followRoute(position: LatLng, accuracyM: number | null): void {
    const active = this.activeRoute();
    if (!active?.live || active.state !== 'ready' || !active.route || active.arrived) return;
    const limits = APP_CONFIG.liveRoute;
    if (accuracyM !== null && accuracyM > limits.maxAccuracyM) return;

    if (distanceM(position, active.place.location) <= limits.arriveM) {
      this.activeRoute.set({ ...active, arrived: true, ahead: [], remainingM: 0, remainingS: 0 });
      this.location.stopWatching();
      return;
    }

    const progress = progressAlong(active.route.coordinates, position);
    if (progress.offRouteM > limits.offRouteM) {
      // One stray fix is usually GPS noise; a second in a row means the user left the path.
      this.offRouteFixes++;
      const cooledDown = Date.now() - this.lastRerouteAt >= limits.rerouteCooldownMs;
      if (this.offRouteFixes >= limits.offRouteFixes && cooledDown) {
        void this.reroute(active, position);
      }
      return;
    }

    this.offRouteFixes = 0;
    this.activeRoute.set({
      ...active,
      ahead: progress.remainingCoords,
      remainingM: progress.remainingM,
      // The routing server's own pace for this route, applied to what is left.
      remainingS: active.route.distanceM
        ? active.route.durationS * (progress.remainingM / active.route.distanceM)
        : 0,
    });
  }

  private async reroute(active: ActiveRoute, origin: LatLng): Promise<void> {
    this.lastRerouteAt = Date.now();
    this.offRouteFixes = 0;
    this.pendingRoute?.abort();
    const controller = (this.pendingRoute = new AbortController());
    try {
      const route = await this.router.route(
        origin,
        active.place.location,
        active.mode,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      this.activeRoute.set({
        ...active,
        origin,
        route,
        ahead: undefined,
        remainingM: undefined,
        remainingS: undefined,
        version: ++this.routeVersion,
      });
    } catch {
      // Keep showing the previous route; the next off-path fix after the cooldown retries.
    }
  }

  /** Opens a randomly chosen open place from the current results. */
  pickForMe(): void {
    let choice = pickPlace(this.results(), this.offered);
    if (!choice && this.offered.size) {
      // Everything has been offered once; start the round again.
      this.offered = new Set();
      choice = pickPlace(this.results(), this.offered);
    }
    if (!choice) return;
    this.offered.add(choice.place.id);
    this.pickedId.set(choice.place.id);
    this.selectedId.set(choice.place.id);
  }

  clearRoute(): void {
    this.pendingRoute?.abort();
    this.activeRoute.set(null);
    this.offRouteFixes = 0;
    this.location.stopWatching();
  }

  async search(center: LatLng = this.mapCenter()): Promise<void> {
    this.pending?.abort();
    const controller = (this.pending = new AbortController());
    const area: SearchArea = { center, radiusM: this.prefs.radiusM() };
    this.loadState.set('loading');
    this.selectedId.set(null);
    this.offered = new Set();
    this.clearRoute();
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
