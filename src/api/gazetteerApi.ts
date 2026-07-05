import { z } from 'zod';

import { apiClient } from './client';
import type {
  Airport,
  CountryInfo,
  CountryMetric,
  CurrencyInfo,
  EarthquakeFeature,
  DisasterEvent,
  Landmark,
  NearbyCategory,
  NearbyPlace,
  PlaceSuggestion,
  RouteSummary,
  WeatherInfo,
} from '../types/app';

const suggestionSchema = z.object({
  name: z.string(),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  countryName: z.string().default(''),
  countryCode: z.string().default(''),
  fcode: z.string(),
  fcl: z.string().optional(),
  fclName: z.string().optional(),
  geonameId: z.number().nullable(),
  wikipediaUrl: z.string().default(''),
  population: z.number().optional(),
});

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const { data } = await apiClient.get('/places', { params: { q: query } });
  return z.array(suggestionSchema).parse(data.geonames ?? []);
}

export async function getCountryInfo(code: string): Promise<CountryInfo> {
  const { data } = await apiClient.get<CountryInfo>(`/countries/${code}`);
  return data;
}

export async function getCountryMetrics(code: string): Promise<CountryMetric> {
  const { data } = await apiClient.get<CountryMetric>(`/countries/${code}/metrics`);
  return data;
}

export async function compareCountries(codes: string[]): Promise<CountryMetric[]> {
  const { data } = await apiClient.get<CountryMetric[]>('/countries/compare', {
    params: { codes: codes.join(',') },
  });
  return data;
}

export async function getCurrencyInfo(code: string): Promise<CurrencyInfo> {
  const { data } = await apiClient.get<CurrencyInfo>(`/currency/${code}`);
  return data;
}

export async function getWeather(lat: number, lng: number, days = 3): Promise<WeatherInfo> {
  const { data } = await apiClient.get<WeatherInfo>('/weather', { params: { lat, lng, days } });
  return data;
}

export async function convertCurrency(from: string, to: string, amount: number) {
  const { data } = await apiClient.get<{ amount: number; from: string; to: string; rate: number; result: number }>(
    '/currency/convert',
    { params: { from, to, amount } },
  );
  return data;
}

export async function getAirports(): Promise<Airport[]> {
  const { data } = await apiClient.get<Airport[]>('/airports');
  return data;
}

export async function getLandmarks(place: PlaceSuggestion): Promise<Landmark[]> {
  const { data } = await apiClient.get<{ geonames: Landmark[] }>('/landmarks', {
    params: {
      lat: place.lat,
      lng: place.lng,
      countryCode: place.countryCode,
      fcode: place.fcode,
    },
  });
  return data.geonames;
}

export async function getNearbyPlaces(
  lat: number,
  lng: number,
  category: NearbyCategory,
): Promise<NearbyPlace[]> {
  const { data } = await apiClient.get<{ places: NearbyPlace[] }>('/nearby', {
    params: { lat, lng, category },
  });
  return data.places;
}

export async function getRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  profile: 'driving' | 'walking' | 'cycling',
): Promise<RouteSummary> {
  const { data } = await apiClient.get<RouteSummary>('/route', {
    params: { fromLat, fromLng, toLat, toLng, profile },
  });
  return data;
}

export async function getEarthquakes(): Promise<EarthquakeFeature[]> {
  const { data } = await apiClient.get<GeoJSON.FeatureCollection<GeoJSON.Point>>('/earthquakes');
  return (data.features ?? []) as EarthquakeFeature[];
}

export async function getDisasters(category: DisasterEvent['category']): Promise<DisasterEvent[]> {
  const { data } = await apiClient.get<{ events: DisasterEvent[] }>('/disasters', { params: { category } });
  return data.events;
}
