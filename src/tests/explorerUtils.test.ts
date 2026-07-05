import { describe, expect, it } from 'vitest';

import { drawingsToGeoJson, formatDuration, polygonAreaKm2 } from '../utils/explorerUtils';
import type { DrawingFeature } from '../types/app';

describe('explorer utilities', () => {
  it('formats route duration for short and long trips', () => {
    expect(formatDuration(42)).toBe('42 min');
    expect(formatDuration(145)).toBe('2h 25m');
  });

  it('calculates a positive polygon area', () => {
    const area = polygonAreaKm2([
      [51.5, -0.12],
      [51.5, -0.1],
      [51.52, -0.1],
      [51.52, -0.12],
    ]);

    expect(area).toBeGreaterThan(2);
  });

  it('exports drawings as GeoJSON features', () => {
    const drawings: DrawingFeature[] = [
      {
        id: 'distance-1',
        kind: 'distance',
        label: 'Distance',
        points: [
          [51.5, -0.12],
          [51.52, -0.1],
        ],
        distanceKm: 2.6,
        createdAt: 1,
      },
      {
        id: 'marker-1',
        kind: 'marker',
        label: 'Marker',
        points: [[51.5, -0.12]],
        createdAt: 2,
      },
    ];

    const geoJson = drawingsToGeoJson(drawings);

    expect(geoJson.type).toBe('FeatureCollection');
    expect(geoJson.features).toHaveLength(2);
    expect(geoJson.features[0].geometry.type).toBe('LineString');
    expect(geoJson.features[1].geometry.type).toBe('Point');
  });
});
