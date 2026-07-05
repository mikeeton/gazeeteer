# Gazetteer

Gazetteer is an interactive React map application for exploring countries and regions. Search for a place, inspect country facts, view local weather and forecasts, compare currency information, and toggle contextual map overlays for airports, landmarks, and recent earthquakes.

## Features

- Full-screen React Leaflet map with street and satellite MapTiler layers
- GeoNames-backed country, state, and county search
- Place details from Rest Countries
- Weather and 3-day forecast from WeatherAPI
- USD exchange-rate lookup for the selected country's currency
- Airport, Wikipedia landmark, and USGS earthquake overlays
- Typed API client, cached requests with TanStack Query, Zustand map state
- Loading states, empty states, toast feedback, and route-level error UI
- Responsive, keyboard-friendly controls

## Screenshots

Add screenshots from a local run to `docs/screenshots/` before publishing a release.

## Technology

- React 19, TypeScript, Vite
- Tailwind CSS
- React Router
- React Leaflet and Leaflet
- TanStack Query, Axios, Zustand
- Framer Motion, React Hot Toast, Lucide React
- Recharts
- Express backend proxy
- Vitest and Testing Library

## Architecture

```text
src/
  api/          Axios client and API functions
  components/   Shared UI such as controls and modals
  constants/    Static lookup tables
  features/     Map and search feature modules
  hooks/        Shared React hooks
  layouts/      Route layouts
  pages/        Routed pages
  store/        Zustand state
  styles/       Tailwind and global CSS
  tests/        Unit tests
  types/        Shared TypeScript types
server/         Express API proxy for third-party services
```

The browser talks to `/api/*`. The Express server owns third-party API credentials and normalizes responses before they reach React. MapTiler tile requests still need a public browser tile key, but the key is configured through the backend instead of being hard-coded in source.

## APIs Used

- MapTiler for map tiles
- GeoNames for search and landmarks
- Rest Countries for country metadata
- WeatherAPI for current weather and forecast data
- open.er-api.com for exchange rates
- USGS earthquake GeoJSON feed
- mwgg Airports dataset

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local environment variables:

   ```bash
   cp .env.example .env
   ```

3. Fill in `MAPTILER_KEY`, `GEONAMES_USER`, and `WEATHER_API_KEY`.

4. Run the frontend and backend:

   ```bash
   npm run dev:full
   ```

5. Open `http://localhost:5173`.

## Environment Variables

| Name | Required | Description |
| --- | --- | --- |
| `PORT` | No | Express server port. Defaults to `3001`. |
| `CLIENT_ORIGIN` | No | Allowed CORS origin. Defaults to `http://localhost:5173`. |
| `MAPTILER_KEY` | Yes | MapTiler browser tile key served by `/api/config`. |
| `GEONAMES_USER` | Yes | GeoNames username for search and landmark lookups. |
| `WEATHER_API_KEY` | Yes | WeatherAPI key, used only by the backend. |

## Quality Checks

```bash
npm run lint
npm test
npm run build
```

## Docker

Build and run both services with Docker Compose:

```bash
docker compose up --build
```

The app and API are served on `http://localhost:3001`.

## Deployment

Build the frontend with `npm run build` and deploy `dist/` to a static host. Deploy `server/index.js` as a Node service with the environment variables above. Configure the static host or reverse proxy so `/api/*` requests route to the backend.

## Design Decisions

- React components replace PHP modal templates so UI state remains predictable.
- TanStack Query owns remote loading, caching, retries, and failure handling.
- Zustand stores only app interaction state, keeping server data in the query cache.
- The backend proxy prevents private WeatherAPI and GeoNames credentials from being embedded in the frontend.

## Future Improvements

- Add Playwright end-to-end coverage for search, overlays, and modal workflows.
- Add screenshot assets to this README.
- Persist user map preferences locally.
- Add rate limiting and request caching to the Express proxy for production traffic.

## Acknowledgements

This project uses public data from GeoNames, Rest Countries, USGS, MapTiler, WeatherAPI, open.er-api.com, and the mwgg Airports dataset.

## License

MIT
