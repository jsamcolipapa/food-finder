import { TestBed } from '@angular/core/testing';
import { FilterPanelService } from './filter-panel.service';

describe('FilterPanelService', () => {
  it('opens from a shell action and closes after the panel is dismissed or applied', () => {
    const panel = TestBed.inject(FilterPanelService);

    expect(panel.open()).toBe(false);
    panel.show();
    expect(panel.open()).toBe(true);
    panel.close();
    expect(panel.open()).toBe(false);
  });
});
