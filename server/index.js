import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3001);
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

app.use(cors({ origin: clientOrigin }));
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: Number(process.env.API_RATE_LIMIT_PER_MINUTE ?? 120),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down and try again shortly.' },
  }),
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/places', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json({ geonames: [] });

  try {
    const username = requireEnv('GEONAMES_USER');
    const responses = await cached(`places:${q.toLowerCase()}`, 1000 * 60 * 10, () =>
      Promise.all(
        ['A', 'P', 'S', 'T', 'H', 'L', 'R', 'V', 'U'].map((featureClass) => {
          const params = new URLSearchParams({
            q,
            maxRows: '12',
            orderby: 'relevance',
            style: 'FULL',
            username,
          });
          params.append('featureClass', featureClass);
          return fetchJson(`https://secure.geonames.org/searchJSON?${params.toString()}`).catch(() => ({
            geonames: [],
          }));
        }),
      ),
    );

    const seen = new Set();
    const candidates = responses
      .flatMap((data) => data.geonames ?? [])
      .map(normalizePlace)
      .filter((place) => {
        const key = `${place.geonameId}-${place.name}-${place.countryCode}`;
        if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    const geonames = rankPlaceSearchResults(q, candidates).slice(0, 40);

    res.json({ geonames });
  } catch (error) {
    sendError(res, error, 'Place search failed');
  }
});

app.get('/api/reverse-place', async (req, res) => {
  try {
    const lat = clamp(Number(req.query.lat), -90, 90);
    const lng = clamp(Number(req.query.lng), -180, 180);
    const data = await cached(`reverse:${lat.toFixed(5)}:${lng.toFixed(5)}`, 1000 * 60 * 60, () =>
      fetchJson(
        `https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({
          lat: String(lat),
          lon: String(lng),
          format: 'jsonv2',
          addressdetails: '1',
          extratags: '1',
          namedetails: '1',
          zoom: '18',
        }).toString()}`,
        {
          headers: {
            accept: 'application/json',
            'user-agent': 'Gazetteer/1.0 reverse-place lookup',
          },
        },
      ),
    );
    const place = normalizeReversePlace(data, lat, lng);
    if (!place) return res.status(404).json({ error: 'No mapped place found here' });
    res.json({ place });
  } catch (error) {
    sendError(res, error, 'Map click lookup failed');
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
    res.json(await cached(`compare:${codes.join(',')}`, 1000 * 60 * 60 * 6, () => Promise.all(codes.map((code) => getCountryMetric(code)))));
  } catch (error) {
    sendError(res, error, 'Country comparison failed');
  }
});

app.get('/api/countries/:code/metrics', async (req, res) => {
  try {
    const code = sanitizeCountryCode(req.params.code);
    res.json(await cached(`metrics:${code}`, 1000 * 60 * 60 * 12, () => getCountryMetric(code)));
  } catch (error) {
    sendError(res, error, 'Country metrics failed');
  }
});

app.get('/api/countries/:code', async (req, res) => {
  try {
    const code = sanitizeCountryCode(req.params.code);
    res.json(await cached(`country:${code}`, 1000 * 60 * 60 * 24, () => getCountryFacts(code)));
  } catch (error) {
    sendError(res, error, 'Country lookup failed');
  }
});

app.get('/api/currency/convert', async (req, res) => {
  try {
    const from = sanitizeCurrencyCode(req.query.from);
    const to = sanitizeCurrencyCode(req.query.to);
    const amount = Math.max(0, Math.min(Number(req.query.amount ?? 1), 1_000_000));
    const data = await cached(`rates:${from}`, 1000 * 60 * 60, () => fetchJson(`https://open.er-api.com/v6/latest/${from}`));
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
    const country = await cached(`country:${code}`, 1000 * 60 * 60 * 24, () => getCountryFacts(code));
    const currencyCode = country.currencies[0]?.code;
    if (!currencyCode) return res.status(404).json({ error: 'Currency not found' });
    const rate = await getUsdRate(currencyCode);

    res.json({
      currency: currencyCode,
      name: country.currencies[0]?.name ?? currencyCode,
      symbol: country.currencies[0]?.symbol ?? '',
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

    const data = await cached(`weather:${lat.toFixed(4)}:${lng.toFixed(4)}:${days}`, 1000 * 60 * 20, () =>
      getWeatherData(lat, lng, days),
    );

    res.json(data);
  } catch (error) {
    sendError(res, error, 'Weather lookup failed');
  }
});

app.get('/api/airports', async (_req, res) => {
  try {
    const data = await cached('airports:all', 1000 * 60 * 60 * 24, () =>
      fetchJson('https://raw.githubusercontent.com/mwgg/Airports/master/airports.json'),
    );
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

app.get('/api/disasters', async (req, res) => {
  try {
    const category = String(req.query.category ?? 'wildfires');
    const eonetCategory = eonetCategories[category] ?? eonetCategories.wildfires;
    const data = await cached(`disasters:${category}`, 1000 * 60 * 20, () =>
      fetchJson(`https://eonet.gsfc.nasa.gov/api/v3/events?category=${eonetCategory}&limit=40`),
    );
    const events = (data.events ?? [])
      .flatMap((event) =>
        (event.geometry ?? []).slice(-1).map((geometry) => {
          const [lng, lat] = geometry.coordinates ?? [];
          return {
            id: event.id,
            title: event.title,
            category,
            lat: Number(lat),
            lng: Number(lng),
            date: geometry.date ?? event.closed ?? '',
            source: event.sources?.[0]?.id ?? 'NASA EONET',
          };
        }),
      )
      .filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lng));
    res.json({ events });
  } catch (error) {
    sendError(res, error, 'Disaster feed failed');
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

    const data = await cached(`landmarks:${fcode}:${countryCode}:${lat}:${lng}`, 1000 * 60 * 60, () => fetchJson(url));
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
    const data = await cached(`nearby:${category}:${lat.toFixed(4)}:${lng.toFixed(4)}`, 1000 * 60 * 15, () => fetchJson('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Gazetteer/1.0' },
      body: `data=${encodeURIComponent(query)}`,
    }));
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
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true`;
    const data = await fetchJson(url);
    const route = data.routes?.[0];
    if (!route) return res.status(404).json({ error: 'No route found' });
    const steps = route.legs?.flatMap((leg) => leg.steps ?? []) ?? [];
    res.json({
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      durationMinutes: Number((route.duration / 60).toFixed(0)),
      profile: ['driving', 'walking', 'cycling'].includes(profile) ? profile : 'driving',
      flightDistanceKm: Number(distanceKm(fromLat, fromLng, toLat, toLng).toFixed(2)),
      summary: route.legs?.[0]?.summary || `${humanize(profile)} route`,
      steps: steps.slice(0, 18).map((step, index) => ({
        instruction: routeInstruction(step, index),
        distanceKm: Number((step.distance / 1000).toFixed(2)),
        durationMinutes: Number((step.duration / 60).toFixed(0)),
        name: step.name ?? '',
      })),
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

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  app.listen(port, () => {
    console.log(`Gazetteer API listening on http://localhost:${port}`);
  });
}

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

const cacheStore = new Map();

async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const cachedValue = cacheStore.get(key);
  if (cachedValue && cachedValue.expiresAt > now) return cachedValue.value;

  const value = await loader();
  cacheStore.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

async function getUsdRate(currencyCode) {
  try {
    const data = await cached('rates:USD', 1000 * 60 * 60, () => fetchJson('https://open.er-api.com/v6/latest/USD'));
    return data.rates?.[currencyCode] ?? null;
  } catch {
    return null;
  }
}

async function getCountryFacts(code) {
  const [geoNames, restCountries] = await Promise.all([
    fetchJson(`https://secure.geonames.org/countryInfoJSON?country=${code}&username=${requireEnv('GEONAMES_USER')}`).catch(
      () => ({ geonames: [] }),
    ),
    getCountryFallback(code),
  ]);
  const geoRaw = geoNames.geonames?.[0] ?? {};
  const restRaw = Array.isArray(restCountries) ? restCountries[0] : null;
  if (!geoRaw.countryCode && !restRaw) throw new Error('Country not found');
  return normalizeCountry(geoRaw, restRaw);
}

async function getCountryFallback(code) {
  const restCountries = await fetchJson(`https://restcountries.com/v3.1/alpha/${code}`).catch(() => []);
  if (Array.isArray(restCountries) && restCountries[0]?.cca2) return restCountries;

  const allCountries = await cached('countries:mledoze', 1000 * 60 * 60 * 24, () =>
    fetchJson('https://raw.githubusercontent.com/mledoze/countries/master/countries.json'),
  );
  return [allCountries.find((country) => country.cca2 === code || country.cca3 === code)].filter(Boolean);
}

async function getWeatherData(lat, lng, days) {
  try {
    const weatherApiKey = process.env.WEATHER_API_KEY;
    if (weatherApiKey) {
      const params = new URLSearchParams({
        key: weatherApiKey,
        q: `${lat},${lng}`,
        days: String(days),
        aqi: 'yes',
        alerts: 'no',
      });
      const data = await fetchJson(`https://api.weatherapi.com/v1/forecast.json?${params.toString()}`);
      return {
        source: 'WeatherAPI',
        condition: data.current.condition,
        temp_c: data.current.temp_c,
        feelslike_c: data.current.feelslike_c,
        humidity: data.current.humidity,
        wind_kph: data.current.wind_kph,
        uv: data.current.uv,
        air_quality: data.current.air_quality,
        astro: data.forecast.forecastday[0].astro,
        forecast: data.forecast,
        hourly: (data.forecast.forecastday[0]?.hour ?? []).slice(0, 24).map((hour) => ({
          time: hour.time,
          temp_c: hour.temp_c,
          humidity: hour.humidity ?? null,
          wind_kph: hour.wind_kph ?? null,
          rainChance: hour.chance_of_rain ?? null,
          uv: hour.uv ?? null,
        })),
      };
    }
  } catch {
    // Fall through to Open-Meteo when the configured WeatherAPI key is invalid or exhausted.
  }

  return getOpenMeteoWeather(lat, lng, days);
}

async function getOpenMeteoWeather(lat, lng, days) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code',
    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: String(days),
  });
  const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  const forecastday = data.daily.time.map((date, index) => ({
    date,
    astro: {
      sunrise: formatTime(data.daily.sunrise[index]),
      sunset: formatTime(data.daily.sunset[index]),
    },
    day: {
      maxtemp_c: data.daily.temperature_2m_max[index],
      mintemp_c: data.daily.temperature_2m_min[index],
      daily_chance_of_rain: data.daily.precipitation_probability_max?.[index] ?? 0,
      uv: data.daily.uv_index_max?.[index] ?? null,
      condition: {
        text: weatherCodeLabel(data.daily.weather_code[index]),
        icon: '',
      },
    },
  }));

  return {
    source: 'Open-Meteo',
    condition: {
      text: weatherCodeLabel(data.current.weather_code),
      icon: '',
    },
    temp_c: data.current.temperature_2m,
    feelslike_c: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    wind_kph: data.current.wind_speed_10m,
    uv: data.daily.uv_index_max?.[0] ?? null,
    air_quality: null,
    astro: forecastday[0]?.astro ?? { sunrise: 'Unavailable', sunset: 'Unavailable' },
    forecast: { forecastday },
    hourly: (data.hourly?.time ?? []).slice(0, 24).map((time, index) => ({
      time,
      temp_c: data.hourly.temperature_2m[index],
      humidity: data.hourly.relative_humidity_2m?.[index] ?? null,
      wind_kph: data.hourly.wind_speed_10m?.[index] ?? null,
      rainChance: data.hourly.precipitation_probability?.[index] ?? null,
      uv: data.hourly.uv_index?.[index] ?? null,
    })),
  };
}

function weatherCodeLabel(code) {
  const labels = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    80: 'Rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    95: 'Thunderstorm',
  };
  return labels[code] ?? 'Variable conditions';
}

function formatTime(value) {
  if (!value) return 'Unavailable';
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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

export function normalizeCountry(geoRaw, restRaw) {
  const currencies = restRaw?.currencies
    ? Object.entries(restRaw.currencies).map(([code, value]) => ({
        code,
        name: value.name ?? code,
        symbol: value.symbol ?? '',
      }))
    : geoRaw.currencyCode
      ? [{ code: geoRaw.currencyCode, name: geoRaw.currencyCode, symbol: '' }]
      : [];
  const population = Number(restRaw?.population ?? geoRaw.population ?? 0);
  const area = Number(restRaw?.area ?? geoRaw.areaInSqKm ?? 0);
  const callingRoot = restRaw?.idd?.root ?? '';
  const callingSuffix = restRaw?.idd?.suffixes?.length === 1 ? restRaw.idd.suffixes[0] : '';
  const cca2 = restRaw?.cca2 ?? geoRaw.countryCode ?? '';
  return {
    name: restRaw?.name?.common ?? geoRaw.countryName ?? '',
    official: restRaw?.name?.official ?? geoRaw.countryName ?? '',
    cca2,
    cca3: restRaw?.cca3 ?? geoRaw.isoAlpha3 ?? '',
    flag: restRaw?.flags?.png ?? (geoRaw.countryCode ? `https://flagcdn.com/w320/${geoRaw.countryCode.toLowerCase()}.png` : ''),
    coat: restRaw?.coatOfArms?.png ?? '',
    capital: restRaw?.capital?.[0] ?? geoRaw.capital ?? '',
    region: restRaw?.region ?? geoRaw.continentName ?? '',
    subregion: restRaw?.subregion ?? geoRaw.continent ?? '',
    population,
    area,
    languages: restRaw?.languages ? Object.values(restRaw.languages) : String(geoRaw.languages ?? '').split(',').filter(Boolean),
    currencies,
    timezones: restRaw?.timezones?.length ? restRaw.timezones : countryTimezoneFallback[cca2] ?? [],
    tld: restRaw?.tld ?? (geoRaw.topLevelDomain ? [geoRaw.topLevelDomain] : []),
    callingCode: callingRoot ? `${callingRoot}${callingSuffix}` : geoRaw.phone ? `+${String(geoRaw.phone).replace(/^\+/, '')}` : '',
    drivingSide: restRaw?.car?.side ?? (leftDrivingCountries.has(cca2) ? 'left' : cca2 ? 'right' : ''),
    maps: restRaw?.maps ?? {},
  };
}

async function getCountryMetric(code) {
  const country = await getCountryFacts(code);
  const [gdpUsd, lifeExpectancy, internetUsersPct, co2PerCapita, literacyPct, inflationPct] = await Promise.all([
    worldBankMetric(country.cca3, 'NY.GDP.MKTP.CD'),
    worldBankMetric(country.cca3, 'SP.DYN.LE00.IN'),
    worldBankMetric(country.cca3, 'IT.NET.USER.ZS'),
    worldBankMetric(country.cca3, 'EN.ATM.CO2E.PC'),
    worldBankMetric(country.cca3, 'SE.ADT.LITR.ZS'),
    worldBankMetric(country.cca3, 'FP.CPI.TOTL.ZG'),
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
    literacyPct,
    inflationPct,
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

export function normalizePlace(place) {
  return {
    name: place.name,
    lat: Number(place.lat),
    lng: Number(place.lng),
    countryName: place.countryName ?? '',
    countryCode: place.countryCode ?? '',
    adminName1: place.adminName1 ?? '',
    adminName2: place.adminName2 ?? '',
    fcode: place.fcode,
    fcl: place.fcl ?? '',
    fclName: place.fclName ?? '',
    geonameId: place.geonameId ?? null,
    wikipediaUrl: place.wikipediaURL ?? place.wikipediaUrl ?? '',
    population: Number(place.population ?? 0),
    alternateNames: normalizeAlternateNames(place.alternateNames),
  };
}

function normalizeReversePlace(raw, fallbackLat, fallbackLng) {
  if (!raw || raw.error) return null;
  const address = raw.address ?? {};
  const displayName = String(raw.display_name ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  const countryCode = String(address.country_code ?? '').toUpperCase();
  const name = firstText(
    raw.name,
    raw.namedetails?.name,
    address.attraction,
    address.tourism,
    address.amenity,
    address.building,
    address.road,
    address.neighbourhood,
    address.suburb,
    address.city,
    address.town,
    address.village,
    address.county,
    address.state,
    displayName[0],
    'Mapped place',
  );
  const feature = reverseFeature(raw);

  return {
    name,
    lat: Number(raw.lat ?? fallbackLat),
    lng: Number(raw.lon ?? fallbackLng),
    countryName: address.country ?? '',
    countryCode,
    adminName1: address.state ?? address.region ?? '',
    adminName2: address.county ?? address.city_district ?? '',
    fcode: feature.fcode,
    fcl: feature.fcl,
    fclName: feature.label,
    geonameId: raw.place_id ? Number(raw.place_id) : null,
    wikipediaUrl: normalizeWikipediaUrl(raw.extratags?.wikipedia ?? ''),
    population: 0,
  };
}

function firstText(...values) {
  return values.map((value) => String(value ?? '').trim()).find(Boolean) ?? '';
}

function reverseFeature(raw) {
  const category = String(raw.category ?? '');
  const type = String(raw.type ?? '');
  const osmClass = `${category}:${type}`;
  if (category === 'boundary' && type === 'administrative') return { fcode: 'ADM', fcl: 'A', label: 'Administrative area' };
  if (category === 'place' && ['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood'].includes(type)) {
    return { fcode: type === 'city' ? 'PPLA' : 'PPL', fcl: 'P', label: humanize(type) };
  }
  if (category === 'aeroway') return { fcode: 'AIRP', fcl: 'S', label: 'Airport' };
  if (category === 'tourism') return { fcode: 'TOUR', fcl: 'S', label: humanize(type || 'landmark') };
  if (category === 'amenity') return { fcode: 'AMEN', fcl: 'S', label: humanize(type || 'amenity') };
  if (category === 'leisure') return { fcode: 'PRK', fcl: 'L', label: humanize(type || 'leisure') };
  if (category === 'natural') return { fcode: type === 'peak' ? 'PK' : 'NAT', fcl: 'T', label: humanize(type || 'natural feature') };
  if (category === 'waterway') return { fcode: 'STM', fcl: 'H', label: humanize(type || 'waterway') };
  if (category === 'highway') return { fcode: 'RD', fcl: 'R', label: humanize(type || 'road') };
  if (category === 'building') return { fcode: 'BLDG', fcl: 'S', label: humanize(type || 'building') };
  return { fcode: type ? type.toUpperCase().slice(0, 8) : 'PLACE', fcl: 'S', label: humanize(osmClass || 'mapped place') };
}

function normalizeWikipediaUrl(value) {
  if (!value) return '';
  const title = String(value).includes(':') ? String(value).split(':').slice(1).join(':') : String(value);
  return `en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function featureRank(fcode, fcl) {
  if (fcode === 'PCLI') return 0;
  if (fcode === 'PPLC') return 1;
  if (['PPLA', 'PPLA2', 'PPLA3', 'PPLA4'].includes(fcode)) return 2;
  if (['PPL', 'PPLX', 'PPLL', 'PPLF'].includes(fcode)) return 3;
  if (fcode === 'ADM1') return 4;
  if (fcode === 'ADM2') return 5;
  if (fcl === 'T') return 6;
  if (fcl === 'S') return 7;
  if (fcl === 'H') return 8;
  if (fcl === 'P') return 9;
  return 10;
}

export function relevanceRank(query, place) {
  const normalizedQuery = normalizeSearchText(query);
  const compactQuery = compactSearchText(normalizedQuery);
  const names = searchNames(place);
  const isShortQuery = normalizedQuery.length <= 3;
  const rank = Math.min(
    ...names.map((name, index) => {
      const compactName = compactSearchText(name);
      const sourcePenalty = index === 0 ? 0 : 0.15;

      if (name === normalizedQuery || compactName === compactQuery) return sourcePenalty;
      if (name.startsWith(`${normalizedQuery} `)) return 1 + sourcePenalty;
      if (!isShortQuery && hasWordPrefix(name, normalizedQuery)) return 2 + sourcePenalty;
      if (!isShortQuery && hasWordMatch(name, normalizedQuery)) return 3 + sourcePenalty;
      return 8 + sourcePenalty;
    }),
  );

  return rank + featureSpecificPenalty(normalizedQuery, place);
}

export function comparePlaceSearchResults(query, a, b) {
  return (
    relevanceRank(query, a) - relevanceRank(query, b) ||
    entityRank(a.fcode, a.fcl) - entityRank(b.fcode, b.fcl) ||
    populationRank(b.population) - populationRank(a.population) ||
    featureRank(a.fcode, a.fcl) - featureRank(b.fcode, b.fcl) ||
    String(a.name).localeCompare(String(b.name))
  );
}

export function rankPlaceSearchResults(query, places) {
  const candidates = places
    .filter((place) => relevanceRank(query, place) < 8)
    .sort((a, b) => comparePlaceSearchResults(query, a, b));
  const strongMatches = candidates.filter((place) => primaryRelevanceRank(query, place) < 3);
  return strongMatches.length >= 3 ? strongMatches : candidates;
}

function featureSpecificPenalty(normalizedQuery, place) {
  if (place.fcode === 'PCLI') return 0;
  if (place.fcl === 'P') {
    const exactTinySettlement =
      normalizeSearchText(place.name) === normalizedQuery && Number(place.population ?? 0) < 1000;
    return exactTinySettlement ? 0.85 : 0;
  }
  if (place.fcl === 'A' && [place.name, place.adminName1, place.adminName2].some((value) => normalizeSearchText(value) === normalizedQuery)) {
    return 0.2;
  }
  if (place.fcl === 'L') return 0.4;
  if (place.fcl === 'T') return 0.55;
  if (['S', 'H', 'R'].includes(place.fcl)) return 0.75;
  return 0.8;
}

function entityRank(fcode, fcl) {
  if (fcode === 'PCLI') return 0;
  if (fcode === 'PPLC') return 1;
  if (fcl === 'P') return 2;
  if (fcl === 'A') return 3;
  if (fcl === 'T') return 4;
  if (['S', 'H'].includes(fcl)) return 5;
  return 5;
}

function searchNames(place) {
  const names = [
    place.name,
    place.asciiName,
    place.toponymName,
    place.countryName,
    place.adminName1,
    place.adminName2,
    ...(place.alternateNames ?? []),
  ];
  return [...names, ...names.map(stripGeographicDescriptor)]
    .map(normalizeSearchText)
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
}

function primaryRelevanceRank(query, place) {
  const normalizedQuery = normalizeSearchText(query);
  return Math.min(
    textRelevance(normalizeSearchText(place.name), normalizedQuery),
    textRelevance(normalizeSearchText(stripGeographicDescriptor(place.name)), normalizedQuery),
  );
}

function textRelevance(name, query) {
  if (name === query || compactSearchText(name) === compactSearchText(query)) return 0;
  if (name.startsWith(`${query} `)) return 1;
  if (query.length > 3 && hasWordPrefix(name, query)) return 2;
  if (query.length > 3 && hasWordMatch(name, query)) return 3;
  return 8;
}

function stripGeographicDescriptor(value) {
  return String(value ?? '').replace(
    /^(mount|mt|mont|monte|lake|river|rio|río|isle|island|cape|point|peak|saint|st)\.?\s+/i,
    '',
  );
}

function normalizeAlternateNames(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : item?.name ?? item?.alternateName ?? ''))
      .filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function compactSearchText(value) {
  return value.replace(/\s+/g, '');
}

function hasWordPrefix(value, query) {
  return value.split(' ').some((word) => word.startsWith(query) && word.length - query.length >= 2);
}

function hasWordMatch(value, query) {
  return value.split(' ').includes(query);
}

function populationRank(population) {
  return Math.log10(Math.max(0, population) + 1);
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

const eonetCategories = {
  wildfires: 'wildfires',
  volcanoes: 'volcanoes',
  storms: 'severeStorms',
  floods: 'floods',
};

const leftDrivingCountries = new Set([
  'AG', 'AI', 'AU', 'BB', 'BD', 'BM', 'BN', 'BS', 'BT', 'BW', 'CY', 'DM', 'FJ', 'FK', 'GB', 'GD', 'GG',
  'GY', 'HK', 'ID', 'IE', 'IM', 'IN', 'JE', 'JM', 'JP', 'KE', 'KI', 'KN', 'KY', 'LC', 'LK', 'LS', 'MO',
  'MS', 'MT', 'MU', 'MW', 'MY', 'MZ', 'NA', 'NP', 'NZ', 'PG', 'PK', 'PN', 'SB', 'SC', 'SG', 'SH', 'SR',
  'SZ', 'TC', 'TH', 'TO', 'TT', 'TV', 'TZ', 'UG', 'VC', 'VG', 'VI', 'WS', 'ZA', 'ZM', 'ZW',
]);

const countryTimezoneFallback = {
  AU: ['UTC+08:00', 'UTC+09:30', 'UTC+10:00'],
  BR: ['UTC-05:00', 'UTC-04:00', 'UTC-03:00', 'UTC-02:00'],
  CA: ['UTC-08:00', 'UTC-07:00', 'UTC-06:00', 'UTC-05:00', 'UTC-04:00', 'UTC-03:30'],
  CN: ['UTC+08:00'],
  DE: ['UTC+01:00'],
  ES: ['UTC+01:00', 'UTC+00:00'],
  FR: ['UTC+01:00'],
  GB: ['UTC+00:00'],
  IN: ['UTC+05:30'],
  IT: ['UTC+01:00'],
  JP: ['UTC+09:00'],
  MX: ['UTC-08:00', 'UTC-07:00', 'UTC-06:00'],
  NG: ['UTC+01:00'],
  RU: ['UTC+02:00', 'UTC+03:00', 'UTC+04:00', 'UTC+05:00', 'UTC+06:00', 'UTC+07:00', 'UTC+08:00', 'UTC+09:00', 'UTC+10:00', 'UTC+11:00', 'UTC+12:00'],
  US: ['UTC-10:00', 'UTC-09:00', 'UTC-08:00', 'UTC-07:00', 'UTC-06:00', 'UTC-05:00'],
  ZA: ['UTC+02:00'],
};

function routeInstruction(step, index) {
  const type = step.maneuver?.type ?? 'continue';
  const modifier = step.maneuver?.modifier ? ` ${step.maneuver.modifier}` : '';
  const road = step.name ? ` on ${step.name}` : '';
  if (type === 'depart') return `Start${road}`;
  if (type === 'arrive') return 'Arrive at destination';
  if (type === 'turn') return `Turn${modifier}${road}`;
  if (type === 'roundabout') return `Enter roundabout${road}`;
  if (type === 'merge') return `Merge${modifier}${road}`;
  return `${index === 0 ? 'Continue' : humanize(type)}${modifier}${road}`;
}
