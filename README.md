# Gazetteer

Gazetteer is a polished React and Express map application for exploring countries, regions, cities, landmarks, weather, nearby places, routes, and live geographic overlays.

It is designed as a portfolio-quality project: full-screen map-first UI, typed frontend data access, backend API proxying, cached third-party requests, local favorites/history, responsive panels, dark mode, drawing tools, exports, and automated tests.

## Features

- Global place search for countries, regions, cities, landmarks, transport hubs, parks, rivers, mountains, islands, and more.
- Interactive Leaflet map with street, satellite, terrain, dark, and light map styles.
- Hamburger map menu with grouped controls for styles, actions, overlays, and detail panels.
- Country and place details with flag, capital, population, area, languages, currency, calling code, domains, timezones, and driving side.
- Weather, multi-day forecast, hourly charts, UV, wind, humidity, sunrise, sunset, and Open-Meteo fallback.
- Country comparison with population, area, density, GDP, life expectancy, internet usage, inflation, languages, currency, calling code, and domains.
- Nearby places from OpenStreetMap Overpass, including cafes, restaurants, hotels, hospitals, banks, police, schools, museums, pharmacies, and parks.
- Route planning with OSRM for driving, walking, and cycling, including direct distance, route distance, travel time, directions, and map line rendering.
- Drawing and measurement tools for markers, circles, rectangles, polygons, distance, radius, area, and GeoJSON export.
- Map overlays for airports, landmarks, earthquakes, wildfires, volcanoes, storms, and floods.
- Favorites and recent search history stored locally.
- Export selected places as JSON, routes and drawings as GeoJSON, and printable PDF reports.
- Responsive desktop and mobile layout with a bottom-sheet explorer panel on smaller screens.
- Toast notifications, skeleton loaders, retryable error states, API rate limiting, and request caching.

## Screenshot

![Gazetteer home screen](docs/screenshots/gazetteer-home.png)

Additional current UI captures:

- [Desktop map workspace](docs/screenshots/final-style-desktop.png)
- [Mobile map workspace](docs/screenshots/final-style-mobile.png)

## Live Demo

Deployment URL: pending. The app is ready for deployment, but publishing requires rotated API credentials and access to your hosting account.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Leaflet and Leaflet
- TanStack Query
- Zustand
- Framer Motion
- Recharts
- Lucide React
- Express
- Vitest
- Playwright

## Data Sources

- GeoNames for search, country facts, and Wikipedia landmarks.
- RestCountries and the mledoze countries dataset for richer country metadata.
- WeatherAPI with Open-Meteo fallback for weather and forecast data.
- OpenStreetMap and Overpass for map tiles and nearby places.
- Esri World Imagery for satellite tiles.
- OSRM for route planning.
- World Bank for country statistics.
- USGS for recent earthquakes.
- NASA EONET for wildfires, volcanoes, storms, and floods.
- open.er-api.com for exchange rates.
- mwgg Airports dataset for airport markers.

## Technical Highlights

- **Architecture:** React/Vite frontend with an Express backend that serves as the API proxy and production static server.
- **Security:** API keys stay server-side in environment variables. `.env` is ignored and `.env.example` contains placeholders only.
- **API proxy:** The backend normalizes third-party responses, applies timeouts, handles provider failures, and keeps browser code free of secrets.
- **Caching:** Expensive upstream calls use in-memory TTL caching to reduce latency and provider load.
- **State management:** Zustand stores selected place, favorites, search history, overlays, routes, nearby places, and drawing state.
- **Map system:** React Leaflet renders base maps, selected places, routes, drawing geometry, nearby places, landmarks, airports, earthquakes, and NASA EONET events.
- **Charts:** Recharts powers dashboard metrics and hourly weather visualisations.
- **Testing:** Vitest covers geographic utilities, local persistence, drawing export helpers, and server data normalization. Playwright covers search, saved places, nearby places, and route planning.
- **Performance:** Vite code splitting separates React, map, query/state, visualisation, and vendor chunks. The explorer panel and detail modals are lazy-loaded.

## Project Structure

```text
src/
  api/          Frontend API functions
  components/   Panels, modals, and shared UI
  constants/    Feature labels and lookup data
  features/     Map and search feature modules
  hooks/        Shared React hooks
  layouts/      Route layouts
  pages/        Page-level screens
  store/        Zustand state and local persistence
  styles/       Tailwind and global CSS
  tests/        Unit and E2E tests
  types/        Shared TypeScript types
  utils/        Geographic helpers
server/
  index.js      Express API proxy, caching, sanitisation, and data normalization
```

## Getting Started

Install dependencies:

```bash
npm install
```

Create the local environment file:

```bash
cp .env.example .env
```

Fill in the required values:

```env
GEONAMES_USER=your_geonames_username_here
WEATHER_API_KEY=your_weatherapi_key_here
```

Start the frontend and backend together:

```bash
npm run dev:full
```

Open the app:

```text
http://localhost:5173
```

## Using The App

1. Search for a place using the search box.
2. Select a result to move the map and unlock place-specific tools.
3. Open the hamburger menu in the top-right corner.
4. Use **Map style** to switch between street, satellite, terrain, dark, and light maps.
5. Use **Quick actions** for theme, favorite, home, and Wikipedia.
6. Use **Overlays** to toggle airports, earthquakes, landmarks, and disaster layers.
7. Use **Details** to open place, currency, weather, and forecast modals.
8. Use the bottom explorer panel for statistics, comparison, nearby places, routes, drawing tools, saved places, and exports.

The hamburger menu also closes when you press `Escape` or click outside it.

## Environment Variables

| Name | Required | Description |
| --- | --- | --- |
| `PORT` | No | Express server port. Defaults to `3001`. |
| `CLIENT_ORIGIN` | No | Allowed CORS origin. Defaults to `http://localhost:5173`. |
| `API_RATE_LIMIT_PER_MINUTE` | No | Per-IP API request limit. Defaults to `120`. |
| `NODE_ENV` | No | Use `production` in deployed environments. |
| `GEONAMES_USER` | Yes | GeoNames username used by backend search, country, and landmark routes. |
| `WEATHER_API_KEY` | Yes | WeatherAPI key used only by the backend. |

## Scripts

```bash
npm run dev       # Start Vite frontend
npm run server    # Start Express backend
npm run dev:full  # Start frontend and backend
npm run lint      # Run ESLint
npm test          # Run Vitest
npm run test:e2e  # Run Playwright tests
npm run build     # Type-check and build production assets
```

## Quality Checks

Before publishing:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
npm audit
```

## Docker

Build and run the production container:

```bash
docker compose up --build
```

The container serves the API and compiled frontend on:

```text
http://localhost:3001
```

## Security Notes

- API keys are loaded from environment variables.
- `.env` is ignored by Git.
- `.env.example` contains placeholders only.
- Third-party API calls are proxied through Express, not exposed directly from the browser.
- User input is bounded or sanitized before upstream API requests.
- API routes are rate-limited.
- Upstream API responses are cached with short TTLs.
- Rotate any credentials that were previously committed, pasted, or shared before deploying publicly.

## Deployment Notes

Run `npm run build` and deploy the generated `dist/` assets with the Express server, or host `dist/` separately and route `/api/*` to the backend.

### Render Blueprint

This repository includes `render.yaml` for a one-service Render deployment.

1. Rotate old API keys before deployment.
2. Create a new Render Blueprint from this repository.
3. Set these Render environment variables:

   ```text
   CLIENT_ORIGIN=https://your-render-app-url.onrender.com
   GEONAMES_USER=your_rotated_geonames_username
   WEATHER_API_KEY=your_rotated_weatherapi_key
   ```

4. Deploy the service.
5. Add the deployed URL to the **Live Demo** section above.

Recommended production settings:

- Set `NODE_ENV=production`.
- Set `CLIENT_ORIGIN` to the deployed frontend URL.
- Keep CORS locked to known origins.
- Rotate GeoNames and WeatherAPI credentials before launch.
- Run the Express server behind HTTPS and a reverse proxy.
- Replace in-memory cache with Redis if running multiple server instances.
- Add production logging and error monitoring.

## Known Limits

- Live flight and marine traffic layers need commercial or restricted APIs, so they are not enabled by default.
- True raster map image export depends on tile-provider CORS permissions. The app supports print/PDF map capture reliably.
- Some country statistics depend on World Bank availability and may be blank for smaller territories.

## License

MIT
