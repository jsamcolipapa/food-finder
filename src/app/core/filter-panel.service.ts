import { Injectable, signal } from '@angular/core';

/** Shared shell state so the desktop sidebar and Discover page can open one filter surface. */
@Injectable({ providedIn: 'root' })
export class FilterPanelService {
  readonly open = signal(false);

  show(): void { this.open.set(true); }
  close(): void { this.open.set(false); }
}
