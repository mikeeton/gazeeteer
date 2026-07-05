import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

app.use(cors({ origin: clientOrigin }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/places', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json({ geonames: [] });

  try {
    const params = new URLSearchParams({
      q,
      maxRows: '20',
      orderby: 'relevance',
      style: 'FULL',
      username: requireEnv('GEONAMES_USER'),
    });
    ['PCLI', 'ADM1', 'ADM2'].forEach((code) => params.append('featureCode', code));

    const data = await fetchJson(`https://secure.geonames.org/searchJSON?${params.toString()}`);
    const geonames = (data.geonames ?? []).map((place) => ({
      name: place.name,
      lat: Number(place.lat),
      lng: Number(place.lng),
      countryName: place.countryName ?? '',
      countryCode: place.countryCode ?? '',
      fcode: place.fcode,
      geonameId: place.geonameId ?? null,
      wikipediaUrl: place.wikipediaURL ?? '',
    }));

    res.json({ geonames });
  } catch (error) {
    sendError(res, error, 'Place search failed');
  }
});

app.get('/api/countries/:code', async (req, res) => {
  try {
    const code = String(req.params.code).toUpperCase();
    const [raw] = await fetchJson(`https://restcountries.com/v3.1/alpha/${code}`);
    res.json({
      name: raw.name?.common ?? '',
      official: raw.name?.official ?? '',
      cca2: raw.cca2 ?? '',
      cca3: raw.cca3 ?? '',
      flag: raw.flags?.png ?? '',
      coat: raw.coatOfArms?.png ?? '',
      capital: raw.capital?.[0] ?? '',
      region: raw.region ?? '',
      subregion: raw.subregion ?? '',
      population: raw.population ?? 0,
      languages: Object.values(raw.languages ?? {}),
      currencies: Object.entries(raw.currencies ?? {}).map(([code, details]) => ({
        code,
        name: details.name,
        symbol: details.symbol ?? '',
      })),
      timezones: raw.timezones ?? [],
    });
  } catch (error) {
    sendError(res, error, 'Country lookup failed');
  }
});

app.get('/api/currency/:code', async (req, res) => {
  try {
    const code = String(req.params.code).toUpperCase();
    const [country] = await fetchJson(`https://restcountries.com/v3.1/alpha/${code}`);
    const currency = Object.entries(country.currencies ?? {})[0];
    if (!currency) return res.status(404).json({ error: 'Currency not found' });

    const [currencyCode, details] = currency;
    const rate = await getUsdRate(currencyCode);

    res.json({
      currency: currencyCode,
      name: details.name ?? '',
      symbol: details.symbol ?? '',
      rate,
    });
  } catch (error) {
    sendError(res, error, 'Currency lookup failed');
  }
});

app.get('/api/weather', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const days = Math.max(1, Math.min(Number(req.query.days ?? 3), 10));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Missing or invalid lat/lng' });
    }

    const params = new URLSearchParams({
      key: requireEnv('WEATHER_API_KEY'),
      q: `${lat},${lng}`,
      days: String(days),
      aqi: 'no',
      alerts: 'no',
    });
    const data = await fetchJson(`https://api.weatherapi.com/v1/forecast.json?${params.toString()}`);

    res.json({
      condition: data.current.condition,
      temp_c: data.current.temp_c,
      humidity: data.current.humidity,
      astro: data.forecast.forecastday[0].astro,
      forecast: data.forecast,
    });
  } catch (error) {
    sendError(res, error, 'Weather lookup failed');
  }
});

app.get('/api/airports', async (_req, res) => {
  try {
    const data = await fetchJson('https://raw.githubusercontent.com/mwgg/Airports/master/airports.json');
    const airports = Object.entries(data)
      .map(([id, airport]) => ({
        id,
        name: airport.name ?? 'Unnamed airport',
        iata: airport.iata ?? '',
        lat: Number(airport.lat),
        lng: Number(airport.lon),
        isoCountry: airport.iso_country ?? '',
      }))
      .filter((airport) => Number.isFinite(airport.lat) && Number.isFinite(airport.lng));

    res.json(airports);
  } catch (error) {
    sendError(res, error, 'Airports feed failed');
  }
});

app.get('/api/earthquakes', async (_req, res) => {
  try {
    const data = await fetchJson('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
    res.json(data);
  } catch (error) {
    sendError(res, error, 'Earthquake feed failed');
  }
});

app.get('/api/landmarks', async (req, res) => {
  try {
    const fcode = String(req.query.fcode ?? '');
    const countryCode = String(req.query.countryCode ?? '');
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const username = requireEnv('GEONAMES_USER');

    const url =
      fcode === 'PCLI'
        ? `https://secure.geonames.org/wikipediaSearchJSON?${new URLSearchParams({
            country: countryCode,
            maxRows: '100',
            username,
          }).toString()}`
        : `https://secure.geonames.org/findNearbyWikipediaJSON?${new URLSearchParams({
            lat: String(lat),
            lng: String(lng),
            radius: '20',
            maxRows: '100',
            username,
          }).toString()}`;

    const data = await fetchJson(url);
    const geonames = (data.geonames ?? [])
      .map((place) => ({
        title: place.title ?? place.name ?? 'Landmark',
        summary: place.summary ?? '',
        lat: Number(place.lat),
        lng: Number(place.lng),
        wikipediaUrl: place.wikipediaUrl ?? '',
      }))
      .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng));

    res.json({ geonames });
  } catch (error) {
    sendError(res, error, 'Landmarks lookup failed');
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Gazetteer API listening on http://localhost:${port}`);
});

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  return response.json();
}

async function getUsdRate(currencyCode) {
  try {
    const data = await fetchJson(`https://open.er-api.com/v6/latest/USD`);
    return data.rates?.[currencyCode] ?? null;
  } catch {
    return null;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function sendError(res, error, fallback) {
  const message = error instanceof Error ? error.message : fallback;
  res.status(502).json({ error: message || fallback });
}
