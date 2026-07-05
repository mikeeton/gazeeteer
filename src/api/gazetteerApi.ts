import { z } from 'zod';

import { apiClient } from './client';
import type {
  Airport,
  AppConfig,
  CountryInfo,
  CurrencyInfo,
  EarthquakeFeature,
  Landmark,
  PlaceSuggestion,
  WeatherInfo,
} from '../types/app';

const suggestionSchema = z.object({
  name: z.string(),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  countryName: z.string().default(''),
  countryCode: z.string().default(''),
  fcode: z.string(),
  geonameId: z.number().nullable(),
  wikipediaUrl: z.string().default(''),
});

export async function getConfig(): Promise<AppConfig> {
  const { data } = await apiClient.get<AppConfig>('/config');
  return data;
}

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const { data } = await apiClient.get('/places', { params: { q: query } });
  return z.array(suggestionSchema).parse(data.geonames ?? []);
}

export async function getCountryInfo(code: string): Promise<CountryInfo> {
  const { data } = await apiClient.get<CountryInfo>(`/countries/${code}`);
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

export async function getEarthquakes(): Promise<EarthquakeFeature[]> {
  const { data } = await apiClient.get<GeoJSON.FeatureCollection<GeoJSON.Point>>('/earthquakes');
  return (data.features ?? []) as EarthquakeFeature[];
}
