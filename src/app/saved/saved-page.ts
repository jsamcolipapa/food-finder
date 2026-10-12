import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Place } from '../core/models';
import { PreferencesService } from '../core/preferences.service';
import { describeKind } from '../core/ranking';
import { PlaceCard } from '../shared/place-card';
import { PlaceDetail } from '../shared/place-detail';

type ListId = 'favorites' | 'want' | 'recent';

interface ListTab {
  id: ListId;
  label: string;
  empty: string;
}

const TABS: ListTab[] = [
  {
    id: 'favorites',
    label: 'Favorites',
    empty: 'Nothing saved yet. Tap the heart on a place to keep it here.',
  },
  {
    id: 'want',
    label: 'Want to try',
    empty: 'Nothing here yet. Open a place and choose “Want to try”.',
  },
  { id: 'recent', label: 'Recent', empty: 'Places you open will show up here.' },
];

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
  protected readonly tabs = TABS;

  /** The open list lives in the URL (`?list=recent`) so it survives a reload. */
  private readonly listParam = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get('list'))),
  );
  protected readonly tab = computed(() => TABS.find((t) => t.id === this.listParam()) ?? TABS[0]);

  protected readonly places = computed<Place[]>(() => {
    switch (this.tab().id) {
      case 'want':
        return this.prefs.wantToTry();
      case 'recent':
        return this.prefs.recent();
      default:
        return this.prefs.favorites();
    }
  });

  protected count(id: ListId): number {
    const lists = {
      favorites: this.prefs.favorites(),
      want: this.prefs.wantToTry(),
      recent: this.prefs.recent(),
    };
    return lists[id].length;
  }

  protected readonly openId = signal<string | null>(null);
  protected readonly open = computed(
    () => this.places().find((p) => p.id === this.openId()) ?? null,
  );
}
