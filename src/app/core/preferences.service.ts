import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { APP_CONFIG } from './config';
import { Place, Preference } from './models';
import { StorageService } from './storage.service';

const BUILT_IN: Preference[] = [
  { id: 'filipino', label: 'Filipino', keywords: ['filipino'], custom: false },
  { id: 'japanese', label: 'Japanese', keywords: ['japanese', 'sushi', 'ramen'], custom: false },
  { id: 'korean', label: 'Korean', keywords: ['korean'], custom: false },
  { id: 'cafe', label: 'Café', keywords: ['coffee', 'cafe'], custom: false },
  { id: 'burgers', label: 'Burgers', keywords: ['burger'], custom: false },
  { id: 'vegetarian', label: 'Vegetarian', keywords: ['vegetarian', 'vegan'], custom: false },
];

export const MAX_CUSTOM_LABEL_LENGTH = 30;

/** Everything the user tunes, persisted in this browser only (no account, no sync). */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly storage = inject(StorageService);

  readonly custom = signal<Preference[]>(this.storage.read('customPreferences', []));
  readonly selectedIds = signal<string[]>(this.storage.read('selectedPreferences', []));
  readonly favorites = signal<Place[]>(this.storage.read('favorites', []));
  readonly hidden = signal<Place[]>(this.storage.read('hidden', []));
  readonly radiusM = signal<number>(this.storage.read('radiusM', APP_CONFIG.defaultRadiusM));
  readonly openNowOnly = signal<boolean>(this.storage.read('openNowOnly', false));

  readonly all = computed(() => [...BUILT_IN, ...this.custom()]);
  readonly selected = computed(() => this.all().filter((p) => this.selectedIds().includes(p.id)));
  readonly favoriteIds = computed(() => new Set(this.favorites().map((p) => p.id)));
  readonly hiddenIds = computed(() => new Set(this.hidden().map((p) => p.id)));

  constructor() {
    effect(() => this.storage.write('customPreferences', this.custom()));
    effect(() => this.storage.write('selectedPreferences', this.selectedIds()));
    effect(() => this.storage.write('favorites', this.favorites()));
    effect(() => this.storage.write('hidden', this.hidden()));
    effect(() => this.storage.write('radiusM', this.radiusM()));
    effect(() => this.storage.write('openNowOnly', this.openNowOnly()));
  }

  toggleSelected(id: string): void {
    this.selectedIds.update((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id],
    );
  }

  /** Adds and selects a custom chip. Returns an error message when the label is unusable. */
  addCustom(rawLabel: string): string | null {
    const label = rawLabel.trim().replace(/\s+/g, ' ').slice(0, MAX_CUSTOM_LABEL_LENGTH);
    if (label.length < 2) {
      return 'Enter at least 2 characters.';
    }
    const keyword = label.toLowerCase();
    const existing = this.all().find((p) => p.label.toLowerCase() === keyword);
    if (existing) {
      if (!this.selectedIds().includes(existing.id)) this.toggleSelected(existing.id);
      return null;
    }
    const id = `custom:${keyword}`;
    this.custom.update((list) => [
      ...list,
      // OSM cuisine values use underscores ("ice_cream"), names use spaces.
      { id, label, keywords: [...new Set([keyword, keyword.replace(/ /g, '_')])], custom: true },
    ]);
    this.selectedIds.update((ids) => [...ids, id]);
    return null;
  }

  removeCustom(id: string): void {
    this.custom.update((list) => list.filter((p) => p.id !== id));
    this.selectedIds.update((ids) => ids.filter((i) => i !== id));
  }

  toggleFavorite(place: Place): boolean {
    const saved = this.favoriteIds().has(place.id);
    this.favorites.update((list) =>
      saved ? list.filter((p) => p.id !== place.id) : [...list, place],
    );
    return !saved;
  }

  hide(place: Place): void {
    if (!this.hiddenIds().has(place.id)) {
      this.hidden.update((list) => [...list, place]);
    }
  }

  unhide(id: string): void {
    this.hidden.update((list) => list.filter((p) => p.id !== id));
  }
}
