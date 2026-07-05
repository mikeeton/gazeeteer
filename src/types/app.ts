export type FeatureCode = 'PCLI' | 'ADM1' | 'ADM2' | 'PPL' | 'NOM' | string;

export type PlaceSuggestion = {
  name: string;
  lat: number;
  lng: number;
  countryName: string;
  countryCode: string;
  fcode: FeatureCode;
  fcl?: string;
  fclName?: string;
  geonameId: number | null;
  wikipediaUrl: string;
  population?: number;
};

export type MapMode = 'street' | 'satellite';

export type OverlayKey = 'airports' | 'earthquakes' | 'landmarks';

export type DetailMode = 'place' | 'currency' | 'weather' | 'forecast';

export type CountryInfo = {
  name: string;
  official: string;
  cca2: string;
  cca3: string;
  flag: string;
  coat: string;
  capital: string;
  region: string;
  subregion: string;
  population: number;
  area: number;
  languages: string[];
  currencies: Array<{ code: string; name: string; symbol: string }>;
  timezones?: string[];
  tld?: string[];
  callingCode?: string;
  drivingSide?: string;
  maps?: { googleMaps?: string; openStreetMaps?: string };
};

export type CurrencyInfo = {
  currency: string;
  name: string;
  symbol: string;
  rate: number | null;
};

export type WeatherInfo = {
  condition: { text: string; icon: string };
  temp_c: number;
  feelslike_c?: number;
  humidity: number;
  wind_kph?: number;
  uv?: number;
  air_quality?: Record<string, number>;
  astro: { sunrise: string; sunset: string };
  forecast: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_c: number;
        mintemp_c: number;
        daily_chance_of_rain: number;
        condition: { text: string; icon: string };
      };
    }>;
  };
};

export type CountryMetric = {
  code: string;
  name: string;
  population: number;
  area: number;
  density: number;
  capital: string;
  region: string;
  currency: string;
  languages: string;
  timezones: string;
  callingCode: string;
  internetDomain: string;
  drivingSide: string;
  gdpUsd: number | null;
  lifeExpectancy: number | null;
  internetUsersPct: number | null;
  co2PerCapita: number | null;
};

export type NearbyCategory =
  | 'restaurants'
  | 'hotels'
  | 'hospitals'
  | 'banks'
  | 'police'
  | 'schools'
  | 'museums'
  | 'cafes'
  | 'pharmacies'
  | 'parks';

export type NearbyPlace = {
  id: string;
  name: string;
  category: NearbyCategory;
  lat: number;
  lng: number;
  distanceKm: number;
};

export type RouteSummary = {
  distanceKm: number;
  durationMinutes: number;
  geometry: GeoJSON.LineString;
};

export type Airport = {
  id: string;
  name: string;
  iata: string;
  lat: number;
  lng: number;
  isoCountry: string;
};

export type Landmark = {
  title: string;
  summary: string;
  lat: number;
  lng: number;
  wikipediaUrl: string;
};

export type EarthquakeFeature = GeoJSON.Feature<
  GeoJSON.Point,
  {
    mag: number | null;
    place: string;
    time: number;
  }
>;
