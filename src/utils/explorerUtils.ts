import type { DrawingFeature, PlaceSuggestion } from '../types/app';

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function drawingSummary(drawing: DrawingFeature) {
  if (drawing.distanceKm) return `${drawing.distanceKm.toFixed(2)} km`;
  if (drawing.radiusKm) return `Radius ${drawing.radiusKm.toFixed(2)} km`;
  if (drawing.areaKm2) return `Area ${drawing.areaKm2.toFixed(2)} km2`;
  return `${drawing.points.length} point${drawing.points.length === 1 ? '' : 's'}`;
}

export function polygonAreaKm2(points: Array<[number, number]>) {
  if (points.length < 3) return 0;
  const origin = points[0];
  const projected = points.map(([lat, lng]) => {
    const x = distanceKm(origin[0], origin[1], origin[0], lng) * (lng < origin[1] ? -1 : 1);
    const y = distanceKm(origin[0], origin[1], lat, origin[1]) * (lat < origin[0] ? -1 : 1);
    return [x, y];
  });
  const area = projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  return Math.abs(area / 2);
}

export function drawingsToGeoJson(drawings: DrawingFeature[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: drawings.map((drawing) => ({
      type: 'Feature',
      properties: {
        id: drawing.id,
        kind: drawing.kind,
        label: drawing.label,
        radiusKm: drawing.radiusKm,
        distanceKm: drawing.distanceKm,
        areaKm2: drawing.areaKm2,
      },
      geometry: drawingGeometry(drawing),
    })),
  };
}

export function uniquePlaces(places: PlaceSuggestion[]) {
  return places.filter(
    (place, index, all) =>
      place.countryCode && all.findIndex((item) => item.geonameId === place.geonameId) === index,
  );
}

export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function drawingGeometry(drawing: DrawingFeature): GeoJSON.Geometry {
  if (drawing.kind === 'marker' || drawing.kind === 'circle') {
    return { type: 'Point', coordinates: [drawing.points[0][1], drawing.points[0][0]] };
  }
  if (drawing.kind === 'rectangle') {
    const [a, b] = drawing.points;
    return {
      type: 'Polygon',
      coordinates: [
        [
          [a[1], a[0]],
          [b[1], a[0]],
          [b[1], b[0]],
          [a[1], b[0]],
          [a[1], a[0]],
        ],
      ],
    };
  }
  if (drawing.kind === 'polygon') {
    const ring = drawing.points.map(([lat, lng]) => [lng, lat]);
    return { type: 'Polygon', coordinates: [[...ring, ring[0]]] };
  }
  return { type: 'LineString', coordinates: drawing.points.map(([lat, lng]) => [lng, lat]) };
}
