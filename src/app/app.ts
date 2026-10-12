import { ChangeDetectionStrategy, Component, Injector, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SwUpdate } from '@angular/service-worker';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ExploreStore } from './core/explore.store';
import { PreferencesService } from './core/preferences.service';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly store = inject(ExploreStore);
  protected readonly prefs = inject(PreferencesService);
  protected readonly theme = inject(ThemeService);
  protected readonly exact = { exact: true };
  protected readonly themeIcons = {
    auto: 'brightness_auto',
    light: 'light_mode',
    dark: 'dark_mode',
  };
  protected readonly themeNames = { auto: 'Auto', light: 'Light', dark: 'Dark' };

  constructor() {
    // The service worker keeps serving the installed version until the page reloads,
    // so tell the user as soon as a newer one has been downloaded.
    const updates = inject(SwUpdate);
    const injector = inject(Injector);
    if (!updates.isEnabled) return;
    updates.versionUpdates.subscribe(async (event) => {
      if (event.type !== 'VERSION_READY') return;
      // Loaded on demand to keep the snack bar out of the initial bundle.
      const { MatSnackBar } = await import('@angular/material/snack-bar');
      injector
        .get(MatSnackBar)
        .open('A new version of Crave is ready.', 'Reload')
        .onAction()
        .subscribe(() => location.reload());
    });
    void updates.checkForUpdate().catch(() => undefined);
  }
}
