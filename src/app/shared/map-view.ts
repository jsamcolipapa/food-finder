import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl';
import type { Feature } from 'geojson';
import { APP_CONFIG } from '../core/config';
import { LatLng, RankedPlace } from '../core/models';
import { MapProvider } from '../core/providers';
import { mapColors } from '../core/theme';

// Bundling breaks MapLibre's own worker lookup, so the worker ships as a static asset
// (see angular.json) and is resolved against <base href>.
setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href);

const SOURCE = 'places';
const LAYER = 'places-circles';
const ROUTE_SOURCE = 'route';

@Component({
  selector: 'app-map-view',
  template: `<div
    #container
    class="map"
    role="application"
    aria-label="Map of nearby places. Drag or use the arrow keys to move the search pin; every place is also in the list."
  ></div>`,
  styles: `
    :host {
      display: block;
      position: relative;
      height: 100%;
    }
    .map {
      position: absolute;
      inset: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapView implements OnDestroy {
  private readonly mapProvider = inject(MapProvider);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');

  /** Map centre, i.e. where the search pin points. Updated as the user moves the map. */
  readonly center = model.required<LatLng>();
  readonly results = input<RankedPlace[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly favoriteIds = input<ReadonlySet<string>>(new Set());
  readonly userLocation = input<LatLng | null>(null);
  /** Path to draw, with the place it leads to highlighted. */
  readonly route = input<[number, number][] | null>(null);
  /** Changes when the route should be framed again: first shown, or recalculated. */
  readonly routeVersion = input(0);
  /** While true the user's own dot marks the start, so no separate start dot is drawn. */
  readonly routeLive = input(false);
  readonly routeDestinationId = input<string | null>(null);
  /** Switches the base map and overlay colours between the light and dark themes. */
  readonly dark = input(false);
  readonly placeSelected = output<string>();

  private map?: MapLibreMap;
  private userMarker?: Marker;
  private resizeObserver?: ResizeObserver;
  /**
   * Bumped each time a base style finishes loading. Swapping styles drops the overlay
   * sources, so every effect that pushes data reads this and re-runs afterwards.
   */
  private readonly styleVersion = signal(0);
  private appliedDark = false;

  constructor() {
    afterNextRender(() => this.init());

    effect(() => {
      const features = this.results().map(({ place }, index) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [place.location.lng, place.location.lat] },
        properties: {
          id: place.id,
          // Only the first page gets a numbered, labelled pin; the rest are small dots.
          rank: index < APP_CONFIG.pageSize ? String(index + 1) : '',
          top: index < APP_CONFIG.pageSize,
          name: place.named && index < APP_CONFIG.pageSize ? place.name : '',
          selected: place.id === this.selectedId() || place.id === this.routeDestinationId(),
          saved: this.favoriteIds().has(place.id),
        },
      }));
      if (this.styleVersion()) {
        this.map
          ?.getSource<GeoJSONSource>(SOURCE)
          ?.setData({ type: 'FeatureCollection', features });
      }
    });

    effect(() => {
      const dark = this.dark();
      if (!this.map || dark === this.appliedDark) return;
      this.appliedDark = dark;
      this.map.setStyle(this.mapProvider.styleUrl(dark));
    });

    effect(() => {
      const coordinates = this.route() ?? [];
      const live = this.routeLive();
      if (!this.styleVersion() || !this.map) return;
      const features: Feature[] = [];
      if (coordinates.length > 1) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates },
          properties: {},
        });
      }
      if (coordinates.length && !live) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coordinates[0] },
          properties: { start: true },
        });
      }
      this.map
        .getSource<GeoJSONSource>(ROUTE_SOURCE)
        ?.setData({ type: 'FeatureCollection', features });
    });

    // Frame the route only when it is first shown or recalculated. Re-framing on every
    // position update would yank the map away from wherever the user had panned.
    effect(() => {
      this.routeVersion();
      if (!this.styleVersion() || !this.map) return;
      const coordinates = untracked(() => this.route()) ?? [];
      if (coordinates.length) {
        const bounds = coordinates.reduce(
          (b, c) => b.extend(c),
          new LngLatBounds(coordinates[0], coordinates[0]),
        );
        // Padding scales with the map so a short (phone) map still has room for the
        // path; a tall map also leaves space for the directions panel that overlays it.
        const height = this.map.getContainer().clientHeight;
        const edge = Math.min(50, height * 0.15);
        this.map.fitBounds(bounds, {
          padding: {
            top: edge + (height > 450 ? 120 : 0),
            bottom: edge + 30,
            left: edge,
            right: edge,
          },
          maxZoom: 17,
          duration: 600,
        });
      }
    });

    effect(() => {
      const target = this.center();
      if (!this.styleVersion() || !this.map) return;
      const current = this.map.getCenter();
      if (Math.abs(current.lat - target.lat) > 1e-6 || Math.abs(current.lng - target.lng) > 1e-6) {
        this.map.easeTo({ center: [target.lng, target.lat], duration: 600 });
      }
    });

    effect(() => {
      const position = this.userLocation();
      if (!this.styleVersion() || !this.map || !position) return;
      if (!this.userMarker) {
        const dot = document.createElement('div');
        dot.className = 'user-dot';
        dot.setAttribute('aria-label', 'Your location');
        this.userMarker = new Marker({ element: dot });
      }
      this.userMarker.setLngLat([position.lng, position.lat]).addTo(this.map);
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  private init(): void {
    const start = this.center();
    this.appliedDark = this.dark();
    const map = (this.map = new MapLibreMap({
      container: this.container().nativeElement,
      style: this.mapProvider.styleUrl(this.dark()),
      center: [start.lng, start.lat],
      zoom: APP_CONFIG.defaultZoom,
      // Full credit line on wide maps; the collapsible (i) form where it would wrap.
      attributionControl: { compact: innerWidth < 600 },
    }));
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    map.once('load', () => {
      // On phones the compact credit opens expanded and covers the map buttons; start it
      // collapsed behind its (i) button. The list below always shows the OSM credit.
      const credit = map.getContainer().querySelector('.maplibregl-ctrl-attrib.maplibregl-compact');
      credit?.classList.remove('maplibregl-compact-show');
      credit?.removeAttribute('open');
    });

    // Runs for the first style and again after every theme switch.
    map.on('style.load', () => {
      const colors = mapColors(this.appliedDark);
      map.addSource(SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addSource(ROUTE_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: ROUTE_SOURCE,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': colors.halo, 'line-width': 9 },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: ROUTE_SOURCE,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': colors.route, 'line-width': 5 },
      });
      map.addLayer({
        id: 'route-start',
        type: 'circle',
        source: ROUTE_SOURCE,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 7,
          'circle-color': colors.route,
          'circle-stroke-color': colors.halo,
          'circle-stroke-width': 3,
        },
      });
      // Numbered pins with a name label, as in the design prototype.
      map.addLayer({
        id: LAYER,
        type: 'circle',
        source: SOURCE,
        layout: { 'circle-sort-key': ['case', ['get', 'top'], 1, 0] },
        paint: {
          'circle-radius': ['case', ['get', 'selected'], 15, ['get', 'top'], 12, 5],
          'circle-opacity': ['case', ['any', ['get', 'top'], ['get', 'selected']], 1, 0.75],
          'circle-color': ['case', ['get', 'saved'], colors.pinSaved, colors.pin],
          'circle-stroke-color': colors.halo,
          'circle-stroke-width': ['case', ['get', 'selected'], 4, ['get', 'top'], 2, 1],
        },
      });
      map.addLayer({
        id: 'places-rank',
        type: 'symbol',
        source: SOURCE,
        layout: {
          'text-field': ['get', 'rank'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': ['case', ['get', 'saved'], colors.onPinSaved, colors.onPin],
        },
      });
      map.addLayer({
        id: 'places-labels',
        type: 'symbol',
        source: SOURCE,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-max-width': 9,
        },
        paint: {
          'text-color': colors.label,
          'text-halo-color': colors.halo,
          'text-halo-width': 2,
        },
      });
      this.styleVersion.update((v) => v + 1);
    });

    map.on('moveend', () => {
      const c = map.getCenter();
      this.center.set({ lat: c.lat, lng: c.lng });
    });
    map.on('click', LAYER, (event) => {
      const id = event.features?.[0]?.properties?.['id'];
      if (typeof id === 'string') this.placeSelected.emit(id);
    });
    map.on('mouseenter', LAYER, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', LAYER, () => (map.getCanvas().style.cursor = ''));

    // The map is hidden behind the list on phones; re-measure whenever its box changes.
    this.resizeObserver = new ResizeObserver(() => map.resize());
    this.resizeObserver.observe(this.container().nativeElement);
  }
}
