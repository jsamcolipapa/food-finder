import { buildRouteUrl } from './osrm-route.provider';

describe('buildRouteUrl', () => {
  const origin = { lat: 14.5547, lng: 121.0244 };
  const destination = { lat: 14.56, lng: 121.03 };

  it('puts coordinates in lng,lat order, origin first', () => {
    expect(buildRouteUrl(origin, destination, 'walk')).toContain(
      '/121.024400,14.554700;121.030000,14.560000?overview=full&geometries=geojson',
    );
  });

  it('uses a different server per travel mode', () => {
    expect(buildRouteUrl(origin, destination, 'walk')).toContain('routed-foot');
    expect(buildRouteUrl(origin, destination, 'drive')).toContain('routed-car');
  });
});
