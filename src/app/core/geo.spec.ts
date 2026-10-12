import { progressAlong } from './geo';

// An L-shaped route: 500 m north, then 300 m east. One degree of latitude is 110 540 m.
const LAT0 = 14.55;
const LNG0 = 121.02;
const north = (m: number) => LAT0 + m / 110540;
const east = (m: number) => LNG0 + m / (111320 * Math.cos((LAT0 * Math.PI) / 180));
const route: [number, number][] = [
  [LNG0, LAT0],
  [LNG0, north(500)],
  [east(300), north(500)],
];
const at = (northM: number, eastM: number) => ({ lat: north(northM), lng: east(eastM) });

describe('progressAlong', () => {
  it('measures the whole route from its start', () => {
    const p = progressAlong(route, at(0, 0));
    expect(p.offRouteM).toBeCloseTo(0, 0);
    expect(p.remainingM).toBeCloseTo(800, 0);
    expect(p.remainingCoords).toHaveLength(3);
  });

  it('sums the rest of the current segment and the ones after a bend', () => {
    const p = progressAlong(route, at(200, 0));
    expect(p.offRouteM).toBeCloseTo(0, 0);
    expect(p.remainingM).toBeCloseTo(600, 0);
  });

  it('snaps a position beside the path onto it', () => {
    const p = progressAlong(route, at(200, 15));
    expect(p.offRouteM).toBeCloseTo(15, 0);
    expect(p.remainingM).toBeCloseTo(600, 0);
    // The trimmed path starts on the line, not at the off-line position.
    expect(p.remainingCoords[0][0]).toBeCloseTo(LNG0, 6);
  });

  it('moves onto the second segment after the bend', () => {
    const p = progressAlong(route, at(500, 100));
    expect(p.remainingM).toBeCloseTo(200, 0);
    expect(p.remainingCoords).toHaveLength(2);
  });

  it('reports how far off the path a stray position is', () => {
    expect(progressAlong(route, at(250, 150)).offRouteM).toBeCloseTo(150, 0);
  });

  it('has nothing left at the end', () => {
    const p = progressAlong(route, at(500, 300));
    expect(p.remainingM).toBeCloseTo(0, 0);
    expect(p.offRouteM).toBeCloseTo(0, 0);
  });

  it('copes with a degenerate one-point route', () => {
    const p = progressAlong([[LNG0, LAT0]], at(100, 0));
    expect(p.remainingM).toBe(0);
    // Measured with the great-circle formula, which differs slightly from the flat one.
    expect(Math.abs(p.offRouteM - 100)).toBeLessThan(2);
  });
});
