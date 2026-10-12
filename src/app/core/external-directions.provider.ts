import { Injectable } from '@angular/core';
import { LatLng, Place } from './models';
import { DirectionsLink, DirectionsProvider } from './providers';

const pair = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/**
 * Destination links for external maps apps. When no origin is passed the maps app
 * uses its own idea of where the user is, so the device location stays out of URLs.
 */
@Injectable()
export class ExternalDirectionsProvider extends DirectionsProvider {
  createLinks(place: Place, origin?: LatLng): DirectionsLink[] {
    const to = pair(place.location);
    const from = origin ? pair(origin) : '';
    return [
      {
        label: 'Google Maps',
        url:
          `https://www.google.com/maps/dir/?api=1&destination=${to}` +
          (from ? `&origin=${from}` : ''),
      },
      {
        label: 'Apple Maps',
        url: `https://maps.apple.com/?daddr=${to}` + (from ? `&saddr=${from}` : ''),
      },
      {
        label: 'OpenStreetMap',
        url:
          'https://www.openstreetmap.org/directions?' + (from ? `from=${from}&` : '') + `to=${to}`,
      },
    ];
  }
}
