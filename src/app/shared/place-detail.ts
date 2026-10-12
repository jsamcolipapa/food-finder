import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FEATURE_LABELS, Place } from '../core/models';
import { describeHours } from '../core/opening-hours';
import { PreferencesService } from '../core/preferences.service';
import { DirectionsProvider } from '../core/providers';
import { describeKind } from '../core/ranking';

@Component({
  selector: 'app-place-detail',
  imports: [A11yModule, MatIconModule],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  templateUrl: './place-detail.html',
  styleUrl: './place-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceDetail {
  private readonly directions = inject(DirectionsProvider);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly prefs = inject(PreferencesService);

  readonly place = input.required<Place>();
  /** Why the place was suggested; omitted outside search results. */
  readonly reason = input<string>();
  /** When true, “Get directions” asks the host to draw a route instead of linking out. */
  readonly inAppDirections = input(false);
  readonly directionsRequested = output<void>();
  readonly closed = output<void>();

  protected readonly kind = computed(() => describeKind(this.place()));
  protected readonly hours = computed(() => describeHours(this.place().openingHours));
  protected readonly features = computed(() => this.place().features.map((f) => FEATURE_LABELS[f]));
  protected readonly saved = computed(() => this.prefs.favoriteIds().has(this.place().id));
  protected readonly hidden = computed(() => this.prefs.hiddenIds().has(this.place().id));
  protected readonly links = computed(() => this.directions.createLinks(this.place()));
  protected readonly primaryLink = computed(() => this.links()[0]);
  protected readonly otherLinks = computed(() => this.links().slice(1));

  protected readonly website = computed(() => {
    const raw = this.place().website?.trim();
    if (!raw) return null;
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return URL.canParse(url) ? url : null;
  });

  /** Details contributors have not mapped, so the user knows the listing is partial. */
  protected readonly missing = computed(() => {
    const p = this.place();
    return [
      !p.named && 'name',
      !p.cuisines.length && 'cuisine',
      !p.openingHours && 'opening hours',
      !p.address && 'address',
    ].filter((label): label is string => !!label);
  });

  protected toggleSaved(): void {
    const nowSaved = this.prefs.toggleFavorite(this.place());
    this.snackBar.open(nowSaved ? 'Saved on this device' : 'Removed from saved', undefined, {
      duration: 2500,
    });
  }

  protected hide(): void {
    const place = this.place();
    this.prefs.hide(place);
    this.closed.emit();
    this.snackBar
      .open(`Hidden “${place.name}” from results`, 'Undo', { duration: 6000 })
      .onAction()
      .subscribe(() => this.prefs.unhide(place.id));
  }
}
