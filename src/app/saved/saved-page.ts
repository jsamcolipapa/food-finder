import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PreferencesService } from '../core/preferences.service';
import { describeKind } from '../core/ranking';
import { PlaceCard } from '../shared/place-card';
import { PlaceDetail } from '../shared/place-detail';

@Component({
  selector: 'app-saved-page',
  imports: [RouterLink, PlaceCard, PlaceDetail],
  templateUrl: './saved-page.html',
  styleUrl: './saved-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SavedPage {
  protected readonly prefs = inject(PreferencesService);
  protected readonly describeKind = describeKind;

  protected readonly openId = signal<string | null>(null);
  protected readonly open = computed(
    () => this.prefs.favorites().find((p) => p.id === this.openId()) ?? null,
  );
}
