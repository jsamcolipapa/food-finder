import { Injectable } from '@angular/core';
import { APP_CONFIG } from './config';
import { MapProvider } from './providers';

@Injectable()
export class OpenFreeMapProvider extends MapProvider {
  styleUrl(dark: boolean): string {
    return dark ? APP_CONFIG.mapDarkStyleUrl : APP_CONFIG.mapStyleUrl;
  }

  readonly attribution = [
    { label: 'OpenFreeMap', url: 'https://openfreemap.org' },
    { label: '© OpenMapTiles', url: 'https://www.openmaptiles.org/' },
    { label: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' },
  ];
}
