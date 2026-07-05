export type FeatureCode = 'PCLI' | 'ADM1' | 'ADM2' | 'PPL' | 'NOM' | string;

export type PlaceSuggestion = {
  name: string;
  lat: number;
  lng: number;
  countryName: string;
  countryCode: string;
  fcode: FeatureCode;
  geonameId: number | null;
  wikipediaUrl: string;
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
  languages: string[];
  currencies: Array<{ code: string; name: string; symbol: string }>;
  timezones?: string[];
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
  humidity: number;
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
