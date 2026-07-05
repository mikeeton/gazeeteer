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
      maxRows: '40',
      orderby: 'relevance',
      style: 'FULL',
      username: requireEnv('GEONAMES_USER'),
    });
    ['A', 'P', 'S', 'T', 'H', 'L', 'R', 'V', 'U'].forEach((featureClass) =>
      params.append('featureClass', featureClass),
    );

    const data = await fetchJson(`https://secure.geonames.org/searchJSON?${params.toString()}`);
    const seen = new Set();
    const geonames = (data.geonames ?? [])
      .map((place) => ({
        name: place.name,
        lat: Number(place.lat),
        lng: Number(place.lng),
        countryName: place.countryName ?? '',
        countryCode: place.countryCode ?? '',
        fcode: place.fcode,
        fcl: place.fcl ?? '',
        fclName: place.fclName ?? '',
        geonameId: place.geonameId ?? null,
        wikipediaUrl: place.wikipediaURL ?? '',
        population: Number(place.population ?? 0),
      }))
      .filter((place) => {
        const key = `${place.geonameId}-${place.name}-${place.countryCode}`;
        if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => featureRank(a.fcode, a.fcl) - featureRank(b.fcode, b.fcl) || b.population - a.population);

    res.json({ geonames });
  } catch (error) {
    sendError(res, error, 'Place search failed');
  }
});

app.get('/api/countries/compare', async (req, res) => {
  try {
    const codes = String(req.query.codes ?? '')
      .split(',')
      .map(sanitizeCountryCode)
      .filter(Boolean)
      .slice(0, 4);
    if (codes.length < 2) return res.status(400).json({ error: 'Choose at least two countries' });
    res.json(await Promise.all(codes.map((code) => getCountryMetric(code))));
  } catch (error) {
    sendError(res, error, 'Country comparison failed');
  }
});

app.get('/api/countries/:code/metrics', async (req, res) => {
  try {
    res.json(await getCountryMetric(sanitizeCountryCode(req.params.code)));
  } catch (error) {
    sendError(res, error, 'Country metrics failed');
  }
});

app.get('/api/countries/:code', async (req, res) => {
  try {
    const code = sanitizeCountryCode(req.params.code);
    res.json(await getCountryFacts(code));
  } catch (error) {
    sendError(res, error, 'Country lookup failed');
  }
});

app.get('/api/currency/convert', async (req, res) => {
  try {
    const from = sanitizeCurrencyCode(req.query.from);
    const to = sanitizeCurrencyCode(req.query.to);
    const amount = Math.max(0, Math.min(Number(req.query.amount ?? 1), 1_000_000));
    const data = await fetchJson(`https://open.er-api.com/v6/latest/${from}`);
    const rate = data.rates?.[to];
    if (!rate) return res.status(404).json({ error: 'Conversion rate not available' });
    res.json({ from, to, amount, rate, result: amount * rate });
  } catch (error) {
    sendError(res, error, 'Currency conversion failed');
  }
});

app.get('/api/currency/:code', async (req, res) => {
  try {
    const code = sanitizeCountryCode(req.params.code);
    const country = await getCountryFacts(code);
    const currencyCode = country.currencies[0]?.code;
    if (!currencyCode) return res.status(404).json({ error: 'Currency not found' });
    const rate = await getUsdRate(currencyCode);

    res.json({
      currency: currencyCode,
      name: currencyCode,
      symbol: '',
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
      aqi: 'yes',
      alerts: 'no',
    });
    const data = await fetchJson(`https://api.weatherapi.com/v1/forecast.json?${params.toString()}`);

    res.json({
      condition: data.current.condition,
      temp_c: data.current.temp_c,
      feelslike_c: data.current.feelslike_c,
      humidity: data.current.humidity,
      wind_kph: data.current.wind_kph,
      uv: data.current.uv,
      air_quality: data.current.air_quality,
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

app.get('/api/nearby', async (req, res) => {
  try {
    const lat = clamp(Number(req.query.lat), -90, 90);
    const lng = clamp(Number(req.query.lng), -180, 180);
    const category = String(req.query.category ?? 'restaurants');
    const selector = overpassSelectors[category] ?? overpassSelectors.restaurants;
    const query = `[out:json][timeout:12];(node[${selector}](around:3500,${lat},${lng});way[${selector}](around:3500,${lat},${lng}););out center 40;`;
    const data = await fetchJson('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Gazetteer/1.0' },
      body: `data=${encodeURIComponent(query)}`,
    });
    const places = (data.elements ?? [])
      .map((item) => {
        const placeLat = Number(item.lat ?? item.center?.lat);
        const placeLng = Number(item.lon ?? item.center?.lon);
        return {
          id: String(item.id),
          name: item.tags?.name ?? humanize(category),
          category,
          lat: placeLat,
          lng: placeLng,
          distanceKm: Number(distanceKm(lat, lng, placeLat, placeLng).toFixed(2)),
        };
      })
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 24);
    res.json({ places });
  } catch (error) {
    sendError(res, error, 'Nearby lookup failed');
  }
});

app.get('/api/route', async (req, res) => {
  try {
    const fromLat = clamp(Number(req.query.fromLat), -90, 90);
    const fromLng = clamp(Number(req.query.fromLng), -180, 180);
    const toLat = clamp(Number(req.query.toLat), -90, 90);
    const toLng = clamp(Number(req.query.toLng), -180, 180);
    const profile = String(req.query.profile ?? 'driving');
    const osrmProfile = profile === 'walking' ? 'foot' : profile === 'cycling' ? 'bike' : 'car';
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const data = await fetchJson(url);
    const route = data.routes?.[0];
    if (!route) return res.status(404).json({ error: 'No route found' });
    res.json({
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      durationMinutes: Number((route.duration / 60).toFixed(0)),
      geometry: route.geometry,
    });
  } catch (error) {
    sendError(res, error, 'Route lookup failed');
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

async function fetchJson(url, init = {}) {
  const timeoutSignal = AbortSignal.timeout(12_000);
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    ...init,
    signal: init.signal ?? timeoutSignal,
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

async function getCountryFacts(code) {
  const data = await fetchJson(
    `https://secure.geonames.org/countryInfoJSON?country=${code}&username=${requireEnv('GEONAMES_USER')}`,
  );
  const raw = data.geonames?.[0];
  if (!raw) throw new Error('Country not found');
  return normalizeGeoNamesCountry(raw);
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

function normalizeGeoNamesCountry(raw) {
  const population = Number(raw.population ?? 0);
  const area = Number(raw.areaInSqKm ?? 0);
  return {
    name: raw.countryName ?? '',
    official: raw.countryName ?? '',
    cca2: raw.countryCode ?? '',
    cca3: raw.isoAlpha3 ?? '',
    flag: raw.countryCode ? `https://flagcdn.com/w320/${raw.countryCode.toLowerCase()}.png` : '',
    coat: '',
    capital: raw.capital ?? '',
    region: raw.continentName ?? '',
    subregion: raw.continent ?? '',
    population,
    area,
    languages: String(raw.languages ?? '')
      .split(',')
      .filter(Boolean),
    currencies: raw.currencyCode ? [{ code: raw.currencyCode, name: raw.currencyCode, symbol: '' }] : [],
    timezones: [],
    tld: raw.topLevelDomain ? [raw.topLevelDomain] : [],
    callingCode: raw.phone ?? '',
    drivingSide: '',
    maps: {},
  };
}

async function getCountryMetric(code) {
  const country = await getCountryFacts(code);
  const [gdpUsd, lifeExpectancy, internetUsersPct, co2PerCapita] = await Promise.all([
    worldBankMetric(country.cca3, 'NY.GDP.MKTP.CD'),
    worldBankMetric(country.cca3, 'SP.DYN.LE00.IN'),
    worldBankMetric(country.cca3, 'IT.NET.USER.ZS'),
    worldBankMetric(country.cca3, 'EN.ATM.CO2E.PC'),
  ]);
  return {
    code: country.cca2,
    name: country.name,
    population: country.population,
    area: country.area,
    density: country.area ? Number((country.population / country.area).toFixed(1)) : 0,
    capital: country.capital,
    region: [country.region, country.subregion].filter(Boolean).join(', '),
    currency: country.currencies.map((item) => `${item.code} ${item.symbol}`.trim()).join(', '),
    languages: country.languages.join(', '),
    timezones: country.timezones?.slice(0, 4).join(', ') ?? '',
    callingCode: country.callingCode,
    internetDomain: country.tld?.join(', ') ?? '',
    drivingSide: country.drivingSide,
    gdpUsd,
    lifeExpectancy,
    internetUsersPct,
    co2PerCapita,
  };
}

async function worldBankMetric(cca3, indicator) {
  try {
    const data = await fetchJson(
      `https://api.worldbank.org/v2/country/${cca3}/indicator/${indicator}?format=json&per_page=8`,
    );
    const point = data?.[1]?.find((item) => typeof item.value === 'number');
    return point ? Number(point.value.toFixed(2)) : null;
  } catch {
    return null;
  }
}

function sanitizeCountryCode(value) {
  const code = String(value ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  if (code.length < 2) throw new Error('Invalid country code');
  return code;
}

function sanitizeCurrencyCode(value) {
  const code = String(value ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  if (code.length !== 3) throw new Error('Invalid currency code');
  return code;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) throw new Error('Invalid coordinate');
  return Math.max(min, Math.min(value, max));
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function humanize(value) {
  return value.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase());
}

function featureRank(fcode, fcl) {
  if (fcode === 'PCLI') return 0;
  if (fcode === 'ADM1') return 1;
  if (fcode === 'ADM2') return 2;
  if (fcl === 'P') return 3;
  if (fcl === 'S') return 4;
  if (fcl === 'T') return 5;
  if (fcl === 'H') return 6;
  return 7;
}

const overpassSelectors = {
  restaurants: 'amenity="restaurant"',
  hotels: 'tourism="hotel"',
  hospitals: 'amenity="hospital"',
  banks: 'amenity="bank"',
  police: 'amenity="police"',
  schools: 'amenity="school"',
  museums: 'tourism="museum"',
  cafes: 'amenity="cafe"',
  pharmacies: 'amenity="pharmacy"',
  parks: 'leisure="park"',
};
