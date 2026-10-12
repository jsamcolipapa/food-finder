import { Injectable, signal } from '@angular/core';
import { APP_CONFIG } from './config';
import { LatLng } from './models';

export type LocationState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

/** Wraps browser geolocation. Nothing is requested until `request()` is called. */
@Injectable({ providedIn: 'root' })
export class LocationService {
  readonly state = signal<LocationState>('idle');
  readonly position = signal<LatLng | null>(null);
  /** What the browser reported for the last failure, shown to help the user fix it. */
  readonly failure = signal<string | null>(null);

  async request(): Promise<LatLng | null> {
    if (!('geolocation' in navigator)) {
      this.state.set('unavailable');
      return null;
    }
    this.state.set('requesting');
    this.failure.set(null);
    try {
      const position = await this.locate();
      this.position.set(position);
      this.state.set('granted');
      return position;
    } catch (error) {
      const { code, message } = error as GeolocationPositionError;
      // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
      this.failure.set(code === 3 ? 'The request timed out.' : message || null);
      this.state.set(code === 1 ? 'denied' : 'unavailable');
      return null;
    }
  }

  /**
   * Tries a precise fix first, then falls back to a coarse one: laptops and desktops
   * without GPS often time out or fail when high accuracy is requested.
   */
  private async locate(): Promise<LatLng> {
    try {
      return await this.getPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
    } catch (error) {
      if ((error as GeolocationPositionError).code === 1) throw error;
      return this.getPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
    }
  }

  /**
   * Rough, city-level position from the visitor's IP address. Sends the request (and
   * therefore the IP) to a third-party service, so call it only as a fallback.
   */
  async approximate(): Promise<LatLng | null> {
    for (const endpoint of APP_CONFIG.ipLocationEndpoints) {
      try {
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(6000) });
        const json = (await response.json()) as { latitude?: unknown; longitude?: unknown };
        const lat = Number(json.latitude);
        const lng = Number(json.longitude);
        const valid = json.latitude != null && json.longitude != null;
        if (response.ok && valid && Number.isFinite(lat) && Number.isFinite(lng)) {
          return { lat, lng };
        }
      } catch {
        // Try the next service.
      }
    }
    return null;
  }

  private getPosition(options: PositionOptions): Promise<LatLng> {
    return new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
        reject,
        options,
      ),
    );
  }
}
