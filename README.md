# Gazetteer

A full-stack interactive world explorer built with React, Express, Leaflet, and TypeScript.

Gazetteer lets users search precise places, inspect countries, identify points on the map, compare national statistics, check weather, plan routes, draw measurements, export geographic data, and toggle live map overlays from a polished map-first interface.

## Project Status

This repository is ready for local review and portfolio presentation. The app has been restyled, search ranking has been tightened, reverse map lookup is available, weather uses a resilient backend fallback, environment files are ignored, and the quality checks pass locally.

Current local development URLs:

```text
Frontend: http://localhost:5173
API:      http://localhost:3001
Health:   http://localhost:3001/api/health
```

Live demo:

```text
https://gazetteer-qsrf.onrender.com
```

## Preview

![Gazetteer desktop map workspace](docs/screenshots/gazetteer-home.png)

- [Desktop command drawer](docs/screenshots/final-style-desktop.png)
- [Mobile command drawer](docs/screenshots/final-style-mobile.png)

## Highlights

- Map-first responsive UI with a compact command drawer, styled route/nearby controls, bottom explorer panel, dark mode, and mobile-friendly Leaflet controls.
- More precise global search ranking for countries, regions, cities, airports, parks, rivers, mountains, islands, and landmarks, including alias/accent handling and stronger exact-match ordering.
- Click-to-identify map behavior with reverse place lookup, selected-place recentering, and Google Maps-style place popups.
- Country detail panels with normalized metadata for population, area, capital, languages, currency, calling code, domains, timezones, and driving side.
- Polished weather dashboard with current conditions, 3-day forecast cards, hourly temperature, rainfall, wind, UV, sunrise/sunset, and air quality visuals.
- Country comparison using normalized local data plus World Bank indicators.
- Route planning with OSRM directions, route summaries, mode-specific travel time, and direct flight distance.
- Drawing and measurement tools for markers, circles, rectangles, polygons, distance, radius, area, and GeoJSON export.
- Map overlays for airports, landmarks, earthquakes, wildfires, volcanoes, storms, floods, and multiple base layers.
- Favorites, recent searches, local persistence, JSON/GeoJSON export, print-friendly reports, and clear empty/error states.

## Tech Stack

- React 19, TypeScript, Vite
- Tailwind CSS with custom shared styling utilities
- React Leaflet and Leaflet
- TanStack Query and Zustand
- Recharts, Framer Motion, Lucide React
- Express API proxy with caching, validation, timeouts, and rate limiting
- Vitest and Playwright

## Architecture

```text
src/
  api/             Frontend API clients
  components/      UI panels, modals, map controls, explorer tabs
  features/        Map and search feature modules
  store/           Zustand state and local persistence
  styles/          Tailwind entry plus shared design primitives
  tests/           Unit and browser tests
  types/           Shared TypeScript types
  utils/           Geography, drawing, formatting, export helpers

server/
  index.js         Express API proxy, caching, provider calls, normalization

render.yaml        Render deployment blueprint
Dockerfile         Production container build
docker-compose.yml Local container runner
```

The browser only calls local `/api/*` routes. The Express server keeps credentials server-side, talks to third-party providers, normalizes inconsistent payloads, caches expensive calls, applies request timeouts, and returns compact frontend-friendly data.

## Data Providers

| Provider | Used for |
| --- | --- |
| GeoNames | Search, country lookup, landmarks |
| RestCountries and mledoze countries | Country metadata fallback and normalization |
| WeatherAPI and Open-Meteo | Current weather, 3-day forecast, hourly metrics |
| Open-Meteo Air Quality | US AQI, PM2.5, and PM10 readings |
| OpenStreetMap, Nominatim, and Overpass | Map data, reverse lookup, and nearby places |
| Esri World Imagery | Satellite tiles |
| OSRM | Route planning |
| World Bank | Country indicators |
| USGS | Earthquakes |
| NASA EONET | Wildfires, volcanoes, storms, floods |
| open.er-api.com | Exchange rates |
| mwgg Airports | Airport overlay data |

## Getting Started

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Add private credentials:

```env
GEONAMES_USER=your_geonames_username_here
WEATHER_API_KEY=your_weatherapi_key_here
```

`GEONAMES_USER` is required for GeoNames-backed search and country routes. `WEATHER_API_KEY` is optional; if it is missing, invalid, or exhausted, the backend falls back to Open-Meteo for current weather, forecast, hourly values, sunrise/sunset, and air quality.

Run the frontend and backend together:

```bash
npm run dev:full
```

Open the frontend:

```text
http://localhost:5173
```

Check the backend:

```text
http://localhost:3001/api/health
```

Stop the local servers with `Ctrl+C` in the terminal running `npm run dev:full`.

For local network testing, Vite also prints a `Network` URL when the dev server starts. Use that URL from another device on the same Wi-Fi.

## Scripts

```bash
npm run dev       # Vite frontend
npm run server    # Express backend
npm run dev:full  # Frontend and backend together
npm run lint      # ESLint
npm test          # Vitest unit tests
npm run test:e2e  # Playwright browser tests
npm run build     # Type-check and production build
```

## Quality Gate

Run these before publishing:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
npm audit --audit-level=high
```

Current local status:

```text
lint: passing
unit tests: passing
e2e tests: passing
production build: passing
high-severity audit: passing
```

## Environment Variables

| Name | Required | Description |
| --- | --- | --- |
| `PORT` | No | Express server port. Defaults to `3001`. |
| `CLIENT_ORIGIN` | No | Allowed CORS origin. Defaults to `http://localhost:5173`. |
| `API_RATE_LIMIT_PER_MINUTE` | No | Per-IP API request limit. Defaults to `120`. |
| `NODE_ENV` | No | Use `production` in deployed environments. |
| `GEONAMES_USER` | Yes | GeoNames username for server-side search, country, and overlay routes. |
| `WEATHER_API_KEY` | No | Optional WeatherAPI key, used only by the backend. Open-Meteo is used as the fallback weather provider. |

## Deployment

The production app can run as one Node service. Express serves the compiled `dist/` frontend and the `/api/*` routes.

### Render

This repository includes `render.yaml`.

1. Rotate any API keys that were ever exposed, committed, pasted, or screenshotted.
2. Create a Render Blueprint from this repository.
3. Add environment variables in Render:

   ```text
   CLIENT_ORIGIN=https://your-app.onrender.com
   GEONAMES_USER=your_rotated_geonames_username
   WEATHER_API_KEY=your_rotated_weatherapi_key
   ```

   `WEATHER_API_KEY` can be omitted if you want the deployed app to use Open-Meteo only.

4. Deploy the service.
5. Verify `/api/health` and the public app URL after the first deploy.

### Docker

```bash
docker compose up --build
```

The container serves the app at:

```text
http://localhost:3001
```

## Security Notes

- `.env` and `.env.*` are ignored by Git.
- `.env.example` contains placeholders only.
- API keys are read from environment variables and stay on the backend.
- Third-party API calls are proxied through Express instead of being made directly from the browser.
- API routes are rate-limited and upstream requests use timeouts.
- Rotate GeoNames, WeatherAPI, MapTiler, or any other key before publishing if it was ever exposed.

## Technical Highlights

- Server-side API proxy keeps credentials private and gives the frontend a stable API surface.
- Provider responses are normalized before reaching UI components, which improves search ordering, reduces blank country fields, and keeps weather payloads consistent across WeatherAPI and Open-Meteo.
- Reverse geocoding uses Nominatim server-side so map clicks can resolve to a usable selected place without exposing provider details to the browser.
- TanStack Query handles request state while Zustand keeps user preferences, saved places, and recent searches persistent.
- Explorer content is split into smaller tab-focused components instead of one oversized panel.
- Drawing utilities convert map interactions into measurements and exportable GeoJSON.
- Playwright verifies the real browser experience, including map rendering and responsive layout behavior.

## Known Limits

- Live flight and marine traffic layers require restricted or commercial APIs.
- Raster map image export depends on tile-provider CORS permissions; print/PDF capture is the reliable export path.
- Some World Bank indicators are unavailable for smaller territories and dependent regions.
- In-memory caching is suitable for one Node instance; use Redis or another shared cache for multi-instance production.

## License

MIT
