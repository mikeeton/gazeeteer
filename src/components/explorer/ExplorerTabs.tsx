import { useQuery } from '@tanstack/react-query';
import { Clock, CloudSun, Heart, ImageDown, SearchX, Star, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  compareCountries,
  getCountryMetrics,
  getNearbyPlaces,
  getRoute,
  getWeather,
} from '../../api/gazetteerApi';
import { featureClasses, featureTypes } from '../../constants/featureTypes';
import { useAppStore } from '../../store/appStore';
import type { DrawingMode, NearbyCategory, PlaceSuggestion } from '../../types/app';
import {
  distanceKm,
  drawingSummary,
  drawingsToGeoJson,
  formatDuration,
  polygonAreaKm2,
  uniquePlaces,
} from '../../utils/explorerUtils';

const nearbyCategories: Array<{ key: NearbyCategory; label: string }> = [
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'hotels', label: 'Hotels' },
  { key: 'hospitals', label: 'Hospitals' },
  { key: 'banks', label: 'Banks' },
  { key: 'police', label: 'Police' },
  { key: 'schools', label: 'Schools' },
  { key: 'museums', label: 'Museums' },
  { key: 'cafes', label: 'Cafes' },
  { key: 'pharmacies', label: 'Pharmacies' },
  { key: 'parks', label: 'Parks' },
];

export function InsightsTab({ place }: { place: PlaceSuggestion }) {
  const metrics = useQuery({
    queryKey: ['metrics', place.countryCode],
    queryFn: () => getCountryMetrics(place.countryCode),
    enabled: Boolean(place.countryCode),
  });
  const weather = useQuery({
    queryKey: ['weather-mini', place.lat, place.lng],
    queryFn: () => getWeather(place.lat, place.lng, 3),
    enabled: place.fcode !== 'PCLI',
  });

  if (metrics.isLoading) return <SkeletonRows />;
  if (metrics.isError || !metrics.data)
    return (
      <PanelError label="Country statistics are unavailable." onRetry={() => metrics.refetch()} />
    );

  const chartData = [
    { name: 'Population', value: metrics.data.population },
    { name: 'Area', value: metrics.data.area },
    { name: 'GDP', value: metrics.data.gdpUsd ?? 0 },
  ];
  const isCountry = place.fcode === 'PCLI';

  return (
    <div className="grid gap-4">
      <article className="place-context-card">
        <div className="min-w-0">
          <p className="ui-section-title">Selected place</p>
          <h3>{place.name}</h3>
          <p>
            {[place.adminName2, place.adminName1, place.countryName].filter(Boolean).join(', ') ||
              place.countryCode ||
              'Mapped location'}
          </p>
        </div>
        <dl>
          <MiniRow label="Type" value={featureLabel(place)} />
          <MiniRow label="Coordinates" value={`${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}`} />
          {!isCountry ? (
            <MiniRow label="Local population" value={place.population ? formatCompact(place.population) : 'No local data'} />
          ) : null}
        </dl>
      </article>
      <div className="panel-section-heading">
        <p className="ui-section-title">{isCountry ? 'Country statistics' : `Country context: ${metrics.data.name}`}</p>
        {!isCountry ? (
          <p>These figures describe {metrics.data.name}, not the exact selected place.</p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label={isCountry ? 'Population' : 'Country pop.'} value={formatCompact(metrics.data.population)} />
        <Stat label="Country density" value={`${metrics.data.density}/km2`} />
        <Stat label="Capital" value={metrics.data.capital || 'Unknown'} />
        <Stat
          label="Life exp."
          value={metrics.data.lifeExpectancy ? `${metrics.data.lifeExpectancy} yrs` : 'No data'}
        />
      </div>
      <div className="ui-card h-44 p-2">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatCompact} width={52} />
            <Tooltip formatter={(value) => formatNumber(Number(value))} />
            <Bar dataKey="value" fill="#0f8b8d" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="ui-card-muted p-3 text-sm text-slate-700">
        <p className="font-semibold text-ink">Travel snapshot</p>
        <p className="mt-1">
          {metrics.data.name} uses {metrics.data.currency || 'local currency'} and drives on the{' '}
          {metrics.data.drivingSide || 'unknown'} side. Internet usage is{' '}
          {metrics.data.internetUsersPct ? `${metrics.data.internetUsersPct}%` : 'not available'}.
          {weather.data
            ? ` Weather at ${place.name} is ${weather.data.condition.text.toLowerCase()}, ${weather.data.temp_c} C.`
            : ''}
        </p>
      </div>
      {weather.data?.hourly?.length ? <WeatherMiniChart weather={weather.data.hourly} /> : null}
    </div>
  );
}

export function CompareTab({ place }: { place: PlaceSuggestion }) {
  const favorites = useAppStore((state) => state.favorites);
  const history = useAppStore((state) => state.history);
  const candidates = uniquePlaces([place, ...favorites, ...history]).filter(
    (item) => item.fcode === 'PCLI',
  );
  const [codes, setCodes] = useState<string[]>(
    [place.countryCode, candidates[1]?.countryCode].filter(Boolean),
  );
  const query = useQuery({
    queryKey: ['compare', codes.join(',')],
    queryFn: () => compareCountries(codes),
    enabled: codes.length >= 2,
  });

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="ui-section-title" htmlFor="compare-select">
          Add country from history
        </label>
        <select
          className="ui-select"
          id="compare-select"
          onChange={(event) => {
            const value = event.target.value;
            if (value && !codes.includes(value))
              setCodes((current) => [...current, value].slice(0, 4));
          }}
          value=""
        >
          <option value="">Choose country</option>
          {candidates.map((item) => (
            <option key={item.countryCode} value={item.countryCode}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        {codes.map((code) => (
          <button
            className="rounded-md border border-teal/20 bg-teal/10 px-3 py-1 text-xs font-bold text-teal transition hover:bg-teal/15"
            key={code}
            onClick={() => setCodes((current) => current.filter((item) => item !== code))}
            type="button"
          >
            {code} ×
          </button>
        ))}
      </div>
      {codes.length < 2 ? (
        <p className="text-sm text-slate-600">Save or search another country to compare.</p>
      ) : null}
      {query.isLoading ? <SkeletonRows /> : null}
      {query.isError ? (
        <PanelError label="Comparison could not be loaded." onRetry={() => query.refetch()} />
      ) : null}
      {query.data ? (
        <div className="grid gap-3">
          {query.data.map((country) => (
            <article className="ui-card p-3" key={country.code}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{country.name}</h3>
                <span className="text-xs text-slate-500">{country.region}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <MiniRow label="Population" value={formatCompact(country.population)} />
                <MiniRow
                  label="GDP"
                  value={country.gdpUsd ? `$${formatCompact(country.gdpUsd)}` : 'No data'}
                />
                <MiniRow
                  label="Life exp."
                  value={country.lifeExpectancy ? `${country.lifeExpectancy}` : 'No data'}
                />
                <MiniRow
                  label="Internet"
                  value={country.internetUsersPct ? `${country.internetUsersPct}%` : 'No data'}
                />
                <MiniRow
                  label="Literacy"
                  value={country.literacyPct ? `${country.literacyPct}%` : 'No data'}
                />
                <MiniRow
                  label="Inflation"
                  value={country.inflationPct ? `${country.inflationPct}%` : 'No data'}
                />
              </dl>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function NearbyTab({ place }: { place: PlaceSuggestion }) {
  const [category, setCategory] = useState<NearbyCategory>('restaurants');
  const setNearbyPlaces = useAppStore((state) => state.setNearbyPlaces);
  const query = useQuery({
    queryKey: ['nearby', place.lat, place.lng, category],
    queryFn: () => getNearbyPlaces(place.lat, place.lng, category),
    enabled: false,
  });

  const loadNearby = async () => {
    const result = await query.refetch();
    setNearbyPlaces(result.data ?? []);
    if (!result.data?.length) toast('No nearby places found for that category.');
  };

  return (
    <div className="grid gap-3">
      <div className="panel-section-heading">
        <p className="ui-section-title">Nearby search</p>
        <p>Find mapped places around {place.name}.</p>
      </div>
      <div className="choice-grid choice-grid-compact" role="listbox" aria-label="Nearby category">
          {nearbyCategories.map((item) => (
            <button
              aria-selected={category === item.key}
              className={`choice-button ${category === item.key ? 'choice-button-active' : ''}`}
              key={item.key}
              onClick={() => setCategory(item.key)}
              role="option"
              type="button"
            >
              {item.label}
            </button>
          ))}
      </div>
      <div className="grid">
        <button aria-label="Find" className="ui-button ui-button-primary" onClick={loadNearby} type="button">
          Find {nearbyCategories.find((item) => item.key === category)?.label.toLowerCase()}
        </button>
      </div>
      {query.isFetching ? <SkeletonRows /> : null}
      {query.isError ? (
        <PanelError label="Nearby places could not be loaded." onRetry={loadNearby} />
      ) : null}
      {query.data?.map((item) => (
        <article className="ui-card flex items-center justify-between p-3 text-sm" key={item.id}>
          <span className="font-medium">{item.name}</span>
          <span className="text-slate-500">{item.distanceKm} km</span>
        </article>
      ))}
    </div>
  );
}

export function RouteTab({ place }: { place: PlaceSuggestion }) {
  const history = useAppStore((state) => state.history);
  const setRoute = useAppStore((state) => state.setRoute);
  const destinations = uniquePlaces(history).filter((item) => item.geonameId !== place.geonameId);
  const [destinationId, setDestinationId] = useState(String(destinations[0]?.geonameId ?? ''));
  const [profile, setProfile] = useState<'driving' | 'walking' | 'cycling'>('driving');
  const destination = destinations.find((item) => String(item.geonameId) === destinationId);
  const flightDistance = useMemo(
    () => (destination ? distanceKm(place.lat, place.lng, destination.lat, destination.lng) : null),
    [destination, place.lat, place.lng],
  );
  const query = useQuery({
    queryKey: ['route', place.geonameId, destination?.geonameId, profile],
    queryFn: () => getRoute(place.lat, place.lng, destination!.lat, destination!.lng, profile),
    enabled: false,
  });

  const calculate = async () => {
    if (!destination) {
      toast.error('Search another place first, then use it as a destination.');
      return;
    }
    const result = await query.refetch();
    setRoute(result.data ?? null);
  };

  return (
    <div className="grid gap-3">
      <div className="panel-section-heading">
        <p className="ui-section-title">Destination</p>
        <p>Choose a recent place to route from {place.name}.</p>
      </div>
      {destinations.length ? (
        <div className="route-destination-list" role="listbox" aria-label="Route destination">
        {destinations.map((item) => (
          <button
            aria-selected={String(item.geonameId) === destinationId}
            className={`route-destination ${String(item.geonameId) === destinationId ? 'route-destination-active' : ''}`}
            key={item.geonameId}
            onClick={() => setDestinationId(String(item.geonameId))}
            role="option"
            type="button"
          >
            <span>
              <strong>{item.name}</strong>
              <small>{[item.adminName1, item.countryName].filter(Boolean).join(', ')}</small>
            </span>
            <em>{distanceKm(place.lat, place.lng, item.lat, item.lng).toFixed(0)} km</em>
          </button>
        ))}
        </div>
      ) : (
        <p className="empty-inline">Search or click another place first, then return here to route.</p>
      )}
      <div className="route-profile-grid">
        {(['driving', 'walking', 'cycling'] as const).map((item) => (
          <button
            className={`choice-button ${profile === item ? 'choice-button-active' : ''}`}
            key={item}
            onClick={() => setProfile(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <button className="ui-button ui-button-primary" onClick={calculate} type="button">
        Calculate route
      </button>
      {flightDistance ? (
        <Stat label="Flight distance" value={`${flightDistance.toFixed(1)} km`} />
      ) : null}
      {query.isFetching ? <SkeletonRows /> : null}
      {query.isError ? (
        <PanelError
          label="Route could not be calculated. Try another destination or profile."
          onRetry={calculate}
        />
      ) : null}
      {query.data ? (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Route distance" value={`${query.data.distanceKm} km`} />
            <Stat label="Travel time" value={formatDuration(query.data.durationMinutes)} />
            <Stat label="Mode" value={query.data.profile} />
            <Stat label="Direct gap" value={`${query.data.flightDistanceKm} km`} />
          </div>
          <div className="ui-card p-3">
            <p className="text-sm font-semibold">Directions</p>
            <ol className="mt-2 grid gap-2 text-sm">
              {query.data.steps.slice(0, 8).map((step, index) => (
                <li
                  className="route-step"
                  key={`${step.instruction}-${index}`}
                >
                  <span className="text-slate-400">{index + 1}</span>
                  <span>{step.instruction}</span>
                  <span className="text-slate-500">{step.distanceKm} km</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function featureLabel(place: PlaceSuggestion) {
  return featureTypes[place.fcode] ?? place.fclName ?? featureClasses[place.fcl ?? ''] ?? place.fcode;
}

export function DrawTab() {
  const {
    drawingMode,
    drawingDraft,
    drawings,
    setDrawingMode,
    setDrawingDraft,
    addDrawing,
    clearDrawings,
  } = useAppStore();

  const finishPolygon = () => {
    if (drawingDraft.length < 3) {
      toast.error('Add at least three points for a polygon.');
      return;
    }
    addDrawing({
      id: crypto.randomUUID(),
      kind: 'polygon',
      label: 'Polygon',
      points: drawingDraft,
      areaKm2: polygonAreaKm2(drawingDraft),
      createdAt: Date.now(),
    });
  };
  const undoPoint = () => setDrawingDraft(drawingDraft.slice(0, -1));

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        {(['select', 'marker', 'circle', 'rectangle', 'polygon', 'distance'] as DrawingMode[]).map(
          (mode) => (
            <button
              className={`ui-button px-2 text-xs ${drawingMode === mode ? 'ui-button-active' : 'ui-button-soft'}`}
              key={mode}
              onClick={() => setDrawingMode(mode)}
              type="button"
            >
              {mode}
            </button>
          ),
        )}
      </div>
      <div className="ui-card-muted p-3 text-sm text-slate-700">
        <p className="font-semibold text-ink">How drawing works</p>
        <p className="mt-1">
          Marker uses one click. Circle, rectangle, and distance use two clicks. Polygon accepts
          multiple clicks, then finish it here.
        </p>
        {drawingDraft.length ? (
          <p className="mt-2 font-semibold text-teal">
            Draft points: {drawingDraft.length}. Click the map to continue.
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button className="ui-button ui-button-primary" onClick={finishPolygon} type="button">
          Finish polygon
        </button>
        <button
          className="ui-button ui-button-soft"
          disabled={!drawingDraft.length}
          onClick={undoPoint}
          type="button"
        >
          Undo point
        </button>
        <button
          className="ui-button ui-button-soft"
          onClick={() => setDrawingDraft([])}
          type="button"
        >
          Clear draft
        </button>
      </div>
      <button
        className="ui-button bg-coral text-white hover:bg-coral/90"
        onClick={clearDrawings}
        type="button"
      >
        Clear drawings
      </button>
      <div className="grid gap-2">
        {drawings.map((drawing) => (
          <article className="ui-card p-3 text-sm" key={drawing.id}>
            <p className="font-semibold">{drawing.label}</p>
            <p className="text-slate-500">{drawingSummary(drawing)}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function SavedTab() {
  const { favorites, history, selectedPlace, toggleFavorite, setSelectedPlace, clearHistory } =
    useAppStore();
  const isFavorite = selectedPlace
    ? favorites.some((item) => item.geonameId === selectedPlace.geonameId)
    : false;

  return (
    <div className="grid gap-4">
      {selectedPlace ? (
        <button
          className="ui-button bg-coral text-white hover:bg-coral/90"
          onClick={() => toggleFavorite(selectedPlace)}
          type="button"
        >
          <Star className="size-4" />
          {isFavorite ? 'Remove favorite' : 'Save current place'}
        </button>
      ) : null}
      <SavedList icon={Heart} label="Favorites" places={favorites} onSelect={setSelectedPlace} />
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Recent searches</p>
        <button
          className="text-slate-500 transition hover:text-coral"
          onClick={clearHistory}
          type="button"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <SavedList icon={Clock} label="History" places={history} onSelect={setSelectedPlace} />
    </div>
  );
}

export function ExportTab({ place }: { place: PlaceSuggestion }) {
  const route = useAppStore((state) => state.route);
  const nearbyPlaces = useAppStore((state) => state.nearbyPlaces);
  const drawings = useAppStore((state) => state.drawings);

  return (
    <div className="grid gap-3">
      <button
        className="ui-button ui-button-primary"
        onClick={() => downloadJson(`${place.name}-place.json`, place)}
        type="button"
      >
        Export selected place JSON
      </button>
      <button
        className="ui-button ui-button-primary"
        disabled={!route}
        onClick={() =>
          route &&
          downloadJson(`${place.name}-route.geojson`, {
            type: 'Feature',
            properties: {
              distanceKm: route.distanceKm,
              durationMinutes: route.durationMinutes,
            },
            geometry: route.geometry,
          })
        }
        type="button"
      >
        Export current route GeoJSON
      </button>
      <button
        className="ui-button ui-button-accent"
        onClick={() => printReport(place, nearbyPlaces)}
        type="button"
      >
        Print / save PDF report
      </button>
      <button
        className="ui-button ui-button-accent"
        onClick={() => exportMapImage(place.name)}
        type="button"
      >
        <ImageDown className="size-4" />
        Export map image
      </button>
      <button
        className="ui-button ui-button-primary"
        disabled={!drawings.length}
        onClick={() => downloadJson(`${place.name}-drawings.geojson`, drawingsToGeoJson(drawings))}
        type="button"
      >
        Export drawings GeoJSON
      </button>
      <p className="text-xs text-slate-500">
        PDF uses the browser print dialog. Map image export saves the rendered Leaflet tiles when
        the browser allows canvas access.
      </p>
    </div>
  );
}

function SavedList({
  icon: Icon,
  label,
  places,
  onSelect,
}: {
  icon: typeof Heart;
  label: string;
  places: PlaceSuggestion[];
  onSelect: (place: PlaceSuggestion) => void;
}) {
  if (!places.length)
    return <p className="text-sm text-slate-500">No {label.toLowerCase()} yet.</p>;
  return (
    <div className="grid gap-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-teal" /> {label}
      </p>
      {places.map((place) => (
        <button
          className="ui-card flex items-center justify-between p-3 text-left text-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
          key={`${label}-${place.geonameId}`}
          onClick={() => onSelect(place)}
          type="button"
        >
          <span className="font-medium">{place.name}</span>
          <span className="text-slate-500">{place.countryCode}</span>
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="ui-card p-3">
      <p className="ui-section-title">{label}</p>
      <p className="mt-1 break-words text-base font-semibold text-ink">{value}</p>
    </article>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </>
  );
}

export function EmptyState() {
  const steps = ['Search a country or city', 'Open map layers', 'Compare, route, draw, export'];
  return (
    <div className="explorer-empty">
      <div className="explorer-empty-header">
        <span className="explorer-empty-icon">
          <SearchX className="size-5" />
        </span>
        <p className="explorer-empty-title">Start exploring</p>
        <p className="explorer-empty-copy">Search for a place to unlock insights and tools.</p>
      </div>
      <ol className="explorer-empty-steps">
        {steps.map((step, index) => (
          <li className="explorer-empty-step" key={step}>
            <span className="explorer-empty-number">{index + 1}</span>
            <span className="explorer-empty-label">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PanelError({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <div className="grid gap-2 rounded-md border border-coral/20 bg-coral/10 p-3 text-sm font-semibold text-coral">
      <span>{label}</span>
      {onRetry ? (
        <button
          className="ui-button w-fit bg-white px-3 py-1 text-xs text-coral"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="grid gap-2">
      {[1, 2, 3].map((item) => (
        <div className="h-12 animate-pulse rounded-md bg-slate-200/70" key={item} />
      ))}
    </div>
  );
}

function formatCompact(value: number) {
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatNumber(value: number) {
  return Intl.NumberFormat().format(value);
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.replace(/[^a-z0-9.-]+/gi, '-').toLowerCase();
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportMapImage(name: string) {
  const map = document.querySelector('.leaflet-container') as HTMLElement | null;
  if (!map) {
    toast.error('Map is not ready yet.');
    return;
  }
  window.print();
  toast.success(
    `Use the print dialog to save ${name} as PDF, or screenshot the map from the print preview.`,
  );
}

function WeatherMiniChart({
  weather,
}: {
  weather: Array<{
    time: string;
    temp_c: number;
    humidity: number | null;
    wind_kph: number | null;
    rainChance: number | null;
  }>;
}) {
  const chartData = weather.slice(0, 12).map((item) => ({
    time: new Date(item.time).toLocaleTimeString(undefined, { hour: '2-digit' }),
    temp: item.temp_c,
    rain: item.rainChance ?? 0,
    wind: item.wind_kph ?? 0,
  }));
  return (
    <div className="grid gap-3">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CloudSun className="size-4 text-teal" /> Hourly weather
      </p>
      <div className="ui-card h-40 p-2">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis width={34} />
            <Tooltip />
            <Line dataKey="temp" dot={false} stroke="#e76f51" strokeWidth={2} />
            <Line dataKey="rain" dot={false} stroke="#0f8b8d" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function printReport(
  place: PlaceSuggestion,
  nearbyPlaces: Array<{ name: string; distanceKm: number }>,
) {
  const report = window.open('', '_blank', 'noopener,noreferrer');
  if (!report) {
    toast.error('Popup blocked. Allow popups to print reports.');
    return;
  }
  report.document.write(`
    <html>
      <head>
        <title>${escapeHtml(place.name)} Gazetteer Report</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f5f7f8;
            color: #151819;
            font-family: Inter, Arial, sans-serif;
          }
          main {
            max-width: 820px;
            margin: 32px auto;
            padding: 32px;
            border: 1px solid #dbe3ea;
            border-radius: 16px;
            background: #fff;
            box-shadow: 0 20px 60px rgba(15, 23, 42, .12);
          }
          header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 18px;
            margin-bottom: 24px;
          }
          h1 { margin: 0 0 6px; font-size: 34px; }
          h2 { margin: 28px 0 12px; font-size: 18px; }
          .eyebrow {
            margin: 0 0 6px;
            color: #0f8b8d;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: .08em;
            text-transform: uppercase;
          }
          .muted { color: #64748b; }
          dl {
            display: grid;
            grid-template-columns: 180px 1fr;
            overflow: hidden;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
          }
          dt, dd { margin: 0; padding: 12px 14px; border-bottom: 1px solid #e2e8f0; }
          dt { background: #f8fafc; font-weight: 800; color: #475569; }
          dd { font-weight: 600; text-align: right; }
          ul { padding-left: 20px; }
          li { margin: 7px 0; }
          footer { margin-top: 28px; color: #64748b; font-size: 12px; }
          @media print {
            body { background: #fff; }
            main { margin: 0; max-width: none; box-shadow: none; border: 0; }
          }
        </style>
      </head>
      <body>
        <main>
          <header>
            <div>
              <p class="eyebrow">Gazetteer report</p>
              <h1>${escapeHtml(place.name)}</h1>
              <p class="muted">${escapeHtml(place.countryName || 'Unknown country')}</p>
            </div>
            <p class="muted">${new Date().toLocaleDateString()}</p>
          </header>
          <dl>
            <dt>Feature</dt><dd>${escapeHtml(place.fcode)}</dd>
            <dt>Coordinates</dt><dd>${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}</dd>
            <dt>Country code</dt><dd>${escapeHtml(place.countryCode || 'Unavailable')}</dd>
            <dt>GeoNames ID</dt><dd>${escapeHtml(String(place.geonameId ?? 'Unavailable'))}</dd>
          </dl>
          <h2>Nearby Places</h2>
          ${
            nearbyPlaces.length
              ? `<ul>${nearbyPlaces.map((item) => `<li>${escapeHtml(item.name)} - ${item.distanceKm} km</li>`).join('')}</ul>`
              : '<p class="muted">No nearby places have been loaded for this report.</p>'
          }
          <footer>Generated locally by Gazetteer. Data availability depends on upstream providers.</footer>
        </main>
      </body>
    </html>
  `);
  report.document.close();
  report.print();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}
