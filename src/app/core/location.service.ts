import { Injectable, signal } from '@angular/core';
import { LatLng } from './models';

export type LocationState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

/** Wraps browser geolocation. Nothing is requested until `request()` is called. */
@Injectable({ providedIn: 'root' })
export class LocationService {
  readonly state = signal<LocationState>('idle');
  readonly position = signal<LatLng | null>(null);

  request(): Promise<LatLng | null> {
    if (!('geolocation' in navigator)) {
      this.state.set('unavailable');
      return Promise.resolve(null);
    }
    this.state.set('requesting');
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const position = { lat: coords.latitude, lng: coords.longitude };
          this.position.set(position);
          this.state.set('granted');
          resolve(position);
        },
        (error) => {
          this.state.set(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    });
  }
}
