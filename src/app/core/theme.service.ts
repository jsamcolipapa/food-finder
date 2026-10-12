import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { PreferencesService, ThemeChoice } from './preferences.service';
import { PAGE_COLORS } from './theme';

const ORDER: ThemeChoice[] = ['auto', 'light', 'dark'];

/** Resolves the user's theme choice against the device setting and applies it. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly prefs = inject(PreferencesService);
  private readonly deviceQuery = matchMedia('(prefers-color-scheme: dark)');
  private readonly deviceDark = signal(this.deviceQuery.matches);

  readonly choice = this.prefs.theme;
  readonly dark = computed(() =>
    this.choice() === 'auto' ? this.deviceDark() : this.choice() === 'dark',
  );

  constructor() {
    this.deviceQuery.addEventListener('change', (event) => this.deviceDark.set(event.matches));
    effect(() => {
      const dark = this.dark();
      document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? PAGE_COLORS.dark : PAGE_COLORS.light);
    });
  }

  /** Auto → Light → Dark → Auto. */
  cycle(): void {
    this.choice.set(ORDER[(ORDER.indexOf(this.choice()) + 1) % ORDER.length]);
  }
}
