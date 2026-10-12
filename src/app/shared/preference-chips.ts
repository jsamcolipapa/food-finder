import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAX_CUSTOM_LABEL_LENGTH, PreferencesService } from '../core/preferences.service';

@Component({
  selector: 'app-preference-chips',
  templateUrl: './preference-chips.html',
  styleUrl: './preference-chips.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreferenceChips {
  protected readonly prefs = inject(PreferencesService);
  protected readonly adding = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly maxLength = MAX_CUSTOM_LABEL_LENGTH;
  protected readonly icons: Record<string, string | undefined> = {
    filipino: '🍲',
    japanese: '🍣',
    korean: '🥢',
    cafe: '☕',
    burgers: '🍔',
    vegetarian: '🥬',
  };

  protected add(input: HTMLInputElement): void {
    const error = this.prefs.addCustom(input.value);
    this.error.set(error);
    if (!error) {
      input.value = '';
      this.adding.set(false);
    }
  }

  protected cancel(): void {
    this.adding.set(false);
    this.error.set(null);
  }
}
