import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { OpenStatus, Place } from '../core/models';
import { describeKind, placeEmoji } from '../core/ranking';

const KIND_LABELS: Record<string, string> = {
  restaurant: 'Restaurant',
  cafe: 'Café',
  fast_food: 'Fast food',
  food_court: 'Food court',
};

@Component({
  selector: 'app-place-card',
  templateUrl: './place-card.html',
  styleUrl: './place-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceCard {
  readonly place = input.required<Place>();
  readonly status = input<OpenStatus>('unknown');
  readonly reason = input<string>();
  readonly saved = input(false);
  readonly opened = output<void>();
  readonly savedToggled = output<void>();

  protected readonly emoji = computed(() => placeEmoji(this.place()));
  /** Stable tile colour per place, so cards don't reshuffle colours between searches. */
  protected readonly tone = computed(() => {
    const id = this.place().id;
    return ['', 'blue', 'pink'][id.charCodeAt(id.length - 1) % 3];
  });
  protected readonly kind = computed(() => {
    const place = this.place();
    const type = KIND_LABELS[place.kind] ?? 'Eatery';
    return place.cuisines.length ? `${describeKind(place)} · ${type}` : type;
  });
}
