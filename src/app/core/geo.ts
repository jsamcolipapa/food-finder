import { LatLng } from './models';

const EARTH_RADIUS_M = 6371000;

export function distanceM(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export interface RouteProgress {
  /** Distance from the position to the nearest point on the path. */
  offRouteM: number;
  /** Length of the path still ahead of that nearest point. */
  remainingM: number;
  /** The path ahead, starting at the nearest point. `[lng, lat]` pairs. */
  remainingCoords: [number, number][];
}

/**
 * Finds where a position falls along a route by projecting it onto each segment.
 * Uses a flat local approximation, which is accurate to well under a metre over the
 * few kilometres a route here covers.
 */
export function progressAlong(coords: [number, number][], position: LatLng): RouteProgress {
  if (coords.length < 2) {
    const only = coords[0];
    const off = only ? distanceM(position, { lat: only[1], lng: only[0] }) : 0;
    return { offRouteM: off, remainingM: 0, remainingCoords: coords.slice() };
  }

  const metresPerDegLat = 110540;
  const metresPerDegLng = 111320 * Math.cos((position.lat * Math.PI) / 180);
  const local = ([lng, lat]: [number, number]): [number, number] => [
    (lng - position.lng) * metresPerDegLng,
    (lat - position.lat) * metresPerDegLat,
  ];
  const points = coords.map(local);
  const lengths = points
    .slice(1)
    .map(([x, y], i) => Math.hypot(x - points[i][0], y - points[i][1]));

  let best = { index: 0, t: 0, off: Infinity };
  for (let i = 0; i < lengths.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const lengthSq = lengths[i] ** 2;
    // The position is the origin of the local frame, so project (0,0) onto a→b.
    const t = lengthSq
      ? Math.min(1, Math.max(0, -(ax * (bx - ax) + ay * (by - ay)) / lengthSq))
      : 0;
    const off = Math.hypot(ax + t * (bx - ax), ay + t * (by - ay));
    if (off < best.off) best = { index: i, t, off };
  }

  const [a, b] = [coords[best.index], coords[best.index + 1]];
  const nearest: [number, number] = [a[0] + best.t * (b[0] - a[0]), a[1] + best.t * (b[1] - a[1])];
  const ahead = lengths.slice(best.index + 1).reduce((sum, length) => sum + length, 0);
  return {
    offRouteM: best.off,
    remainingM: (1 - best.t) * lengths[best.index] + ahead,
    remainingCoords: [nearest, ...coords.slice(best.index + 1)],
  };
}
