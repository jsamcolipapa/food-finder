import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { APP_CONFIG } from '../core/config';
import { ExploreStore } from '../core/explore.store';
import { FilterPanelService } from '../core/filter-panel.service';
import { formatDistance } from '../core/geo';
import { LocationService } from '../core/location.service';
import { ThemeService } from '../core/theme.service';
import { FEATURE_LABELS, Place, PlaceFeature, TravelMode } from '../core/models';
import { PreferencesService } from '../core/preferences.service';
import { DirectionsProvider } from '../core/providers';
import { MapView } from '../shared/map-view';
import { PlaceCard } from '../shared/place-card';
import { PlaceDetail } from '../shared/place-detail';
import { PreferenceChips } from '../shared/preference-chips';

@Component({
  selector: 'app-explore-page',
  imports: [MatIconModule, MatProgressBarModule, MapView, PlaceCard, PlaceDetail, PreferenceChips],
  templateUrl: './explore-page.html',
  styleUrl: './explore-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class ExplorePage {
  protected readonly store = inject(ExploreStore);
  private readonly filterPanel = inject(FilterPanelService);
  protected readonly prefs = inject(PreferencesService);
  protected readonly location = inject(LocationService);
  protected readonly theme = inject(ThemeService);
  private readonly directions = inject(DirectionsProvider);
  private readonly injector = inject(Injector);

  private readonly queryInput = viewChild.required<ElementRef<HTMLInputElement>>('query');
  private readonly listEl = viewChild.required<ElementRef<HTMLElement>>('list');
  private readonly mapEl = viewChild.required<ElementRef<HTMLElement>>('map');

  protected readonly view = signal<'list' | 'map'>('list');
  protected readonly filtersOpen = this.filterPanel.open;
  protected readonly stagedRadius = signal(this.prefs.radiusM());
  protected readonly stagedCuisines = signal<string[]>(this.prefs.selectedIds());
  protected readonly stagedFeatures = signal<PlaceFeature[]>(this.prefs.featureFilters());
  protected readonly stagedOpenNow = signal(this.prefs.openNowOnly());
  protected readonly addingCuisine = signal(false);
  protected readonly cuisineError = signal<string | null>(null);
  protected readonly radiusOptions = APP_CONFIG.radiusOptionsM;
  protected readonly maxResults = APP_CONFIG.maxResults;
  protected readonly formatDistance = formatDistance;
  protected readonly featureOptions = Object.entries(FEATURE_LABELS) as [PlaceFeature, string][];

  /** How many cards are rendered; grows with “Show more” and resets when results change. */
  protected readonly shown = signal(APP_CONFIG.pageSize);
  protected readonly page = computed(() => this.store.results().slice(0, this.shown()));
  protected readonly pageSize = APP_CONFIG.pageSize;

  constructor() {
    this.store.locateOnStart();
    effect(() => {
      this.store.results();
      this.shown.set(APP_CONFIG.pageSize);
    });
    effect(() => {
      if (!this.filtersOpen()) return;
      this.stagedRadius.set(this.prefs.radiusM());
      this.stagedCuisines.set([...this.prefs.selectedIds()]);
      this.stagedFeatures.set([...this.prefs.featureFilters()]);
      this.stagedOpenNow.set(this.prefs.openNowOnly());
    });
  }

  protected readonly locationLabel = computed(() => {
    switch (this.location.state()) {
      case 'requesting':
        return 'Locating…';
      case 'granted':
        return this.store.pinMoved() ? 'Back to my location' : 'Near you';
      default:
        return 'Use my location';
    }
  });

  protected readonly showSearchHere = computed(
    () =>
      this.store.loadState() !== 'loading' &&
      (this.store.searched() === null || this.store.pinMoved()),
  );

  /** The line to draw: the part still ahead while following the user, else the whole route. */
  protected readonly routeCoords = computed(() => {
    const active = this.store.activeRoute();
    return active?.ahead ?? active?.route?.coordinates ?? null;
  });

  /** Hand-off link for turn-by-turn navigation along the route being shown. */
  protected readonly navigateUrl = computed(() => {
    const active = this.store.activeRoute();
    return active ? this.directions.createLinks(active.place)[0].url : null;
  });

  protected route(place: Place, mode: TravelMode = 'walk'): void {
    const changingMode = this.store.activeRoute()?.place.id === place.id;
    this.store.showRoute(place, mode);
    // Switching walk/drive happens on the map already, so leave the page where it is.
    if (!changingMode) this.show('map');
  }

  protected duration(seconds: number): string {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  }

  protected show(view: 'list' | 'map'): void {
    this.view.set(view);
    // Wait for the next render: closing the place dialog hands focus back to its card,
    // which scrolls the page there and would cancel a scroll started before it.
    afterNextRender(
      () => {
        const target = view === 'map' ? this.mapEl() : this.listEl();
        // Jump rather than animate: a smooth scroll is dropped if focus moves mid-way.
        target.nativeElement.scrollIntoView({ block: 'start' });
      },
      { injector: this.injector },
    );
  }

  protected setRadius(value: string): void {
    this.prefs.radiusM.set(Number(value));
    const area = this.store.searched();
    if (area) this.store.search(area.center);
  }

  protected clearFilters(): void {
    this.prefs.selectedIds.set([]);
    this.prefs.openNowOnly.set(false);
    this.prefs.featureFilters.set([]);
    this.store.query.set('');
  }

  protected openFilters(): void {
    this.filterPanel.show();
  }

  protected closeFilters(): void { this.filterPanel.close(); }

  protected toggleStagedCuisine(id: string): void {
    this.stagedCuisines.update((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  protected addCuisine(input: HTMLInputElement): void {
    const raw = input.value.trim().replace(/\s+/g, ' ');
    const error = this.prefs.addCustom(raw, false);
    this.cuisineError.set(error);
    if (error) return;

    const preference = this.prefs.all().find((item) => item.label.toLowerCase() === raw.toLowerCase());
    if (preference && !this.stagedCuisines().includes(preference.id)) {
      this.stagedCuisines.update((items) => [...items, preference.id]);
    }
    input.value = '';
    this.addingCuisine.set(false);
    this.cuisineError.set(null);
  }

  protected cancelCuisine(): void {
    this.addingCuisine.set(false);
    this.cuisineError.set(null);
  }

  protected toggleStagedFeature(feature: PlaceFeature): void {
    this.stagedFeatures.update((items) => items.includes(feature) ? items.filter((item) => item !== feature) : [...items, feature]);
  }

  protected resetFilters(): void {
    this.stagedRadius.set(APP_CONFIG.defaultRadiusM);
    this.stagedCuisines.set([]);
    this.stagedFeatures.set([]);
    this.stagedOpenNow.set(false);
  }

  protected applyFilters(): void {
    const radiusChanged = this.prefs.radiusM() !== this.stagedRadius();
    this.prefs.radiusM.set(this.stagedRadius());
    this.prefs.selectedIds.set(this.stagedCuisines());
    this.prefs.featureFilters.set(this.stagedFeatures());
    this.prefs.openNowOnly.set(this.stagedOpenNow());
    this.filterPanel.close();
    if (radiusChanged && this.store.searched()) this.store.search(this.store.searched()!.center);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.filtersOpen()) {
      this.closeFilters();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.queryInput().nativeElement.focus();
    }
  }
}
