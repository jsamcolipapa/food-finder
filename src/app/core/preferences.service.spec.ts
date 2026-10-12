import { TestBed } from '@angular/core/testing';
import { Place } from './models';
import { PreferencesService } from './preferences.service';

function place(id: string): Place {
  return {
    id,
    name: id,
    named: true,
    location: { lat: 0, lng: 0 },
    kind: 'restaurant',
    cuisines: [],
    vegetarian: false,
    features: [],
    sourceUrl: `https://www.openstreetmap.org/${id}`,
  };
}

describe('PreferencesService lists', () => {
  let prefs: PreferencesService;

  beforeEach(() => {
    localStorage.clear();
    prefs = TestBed.inject(PreferencesService);
  });

  it('keeps recent places newest first without duplicates', () => {
    prefs.recordView(place('a'));
    prefs.recordView(place('b'));
    prefs.recordView(place('a'));
    expect(prefs.recent().map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('caps the recent list at 20', () => {
    for (let i = 0; i < 25; i++) prefs.recordView(place(`p${i}`));
    expect(prefs.recent()).toHaveLength(20);
    expect(prefs.recent()[0].id).toBe('p24');
    prefs.clearRecent();
    expect(prefs.recent()).toEqual([]);
  });

  it('toggles a place on and off the want-to-try list', () => {
    expect(prefs.toggleWantToTry(place('a'))).toBe(true);
    expect(prefs.wantToTryIds().has('a')).toBe(true);
    expect(prefs.toggleWantToTry(place('a'))).toBe(false);
    expect(prefs.wantToTry()).toEqual([]);
  });

  it('fills in fields missing from places stored by older versions', () => {
    const { features: _omitted, ...old } = place('legacy');
    localStorage.setItem('crave:favorites', JSON.stringify([old]));
    TestBed.resetTestingModule();
    expect(TestBed.inject(PreferencesService).favorites()[0].features).toEqual([]);
  });
});
