import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Clock,
  CloudSun,
  GitCompare,
  Heart,
  FileDown,
  ImageDown,
  MapPin,
  MousePointer2,
  Navigation,
  Route,
  SearchX,
  Star,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  compareCountries,
  getCountryMetrics,
  getNearbyPlaces,
  getRoute,
  getWeather,
} from '../api/gazetteerApi';
import { useAppStore } from '../store/appStore';
import type { DrawingFeature, DrawingMode, NearbyCategory, PlaceSuggestion } from '../types/app';

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

type Tab = 'insights' | 'compare' | 'nearby' | 'route' | 'draw' | 'saved' | 'export';

export function ExplorerPanel() {
  const [tab, setTab] = useState<Tab>('insights');
  const selectedPlace = useAppStore((state) => state.selectedPlace);

  return (
    <aside className="explorer-panel absolute bottom-4 left-4 z-[1000] w-[min(94vw,27rem)] overflow-hidden rounded-md border border-white/10 bg-white/94 text-ink shadow-panel backdrop-blur dark-panel">
      <nav className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/90" aria-label="Explorer tools">
        <TabButton active={tab === 'insights'} icon={BarChart3} label="Stats" onClick={() => setTab('insights')} />
        <TabButton active={tab === 'compare'} icon={GitCompare} label="Compare" onClick={() => setTab('compare')} />
        <TabButton active={tab === 'nearby'} icon={MapPin} label="Nearby" onClick={() => setTab('nearby')} />
        <TabButton active={tab === 'route'} icon={Route} label="Route" onClick={() => setTab('route')} />
        <TabButton active={tab === 'draw'} icon={MousePointer2} label="Draw" onClick={() => setTab('draw')} />
        <TabButton active={tab === 'saved'} icon={Heart} label="Saved" onClick={() => setTab('saved')} />
        <TabButton active={tab === 'export'} icon={FileDown} label="Export" onClick={() => setTab('export')} />
      </nav>
      <div className="max-h-[42vh] overflow-y-auto p-4 md:max-h-[56vh]">
        {!selectedPlace && tab !== 'saved' ? <EmptyState /> : null}
        {selectedPlace && tab === 'insights' ? <InsightsTab place={selectedPlace} /> : null}
        {selectedPlace && tab === 'compare' ? <CompareTab place={selectedPlace} /> : null}
        {selectedPlace && tab === 'nearby' ? <NearbyTab place={selectedPlace} /> : null}
        {selectedPlace && tab === 'route' ? <RouteTab place={selectedPlace} /> : null}
        {tab === 'draw' ? <DrawTab /> : null}
        {tab === 'saved' ? <SavedTab /> : null}
        {selectedPlace && tab === 'export' ? <ExportTab place={selectedPlace} /> : null}
      </div>
    </aside>
  );
}

function InsightsTab({ place }: { place: PlaceSuggestion }) {
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
  if (metrics.isError || !metrics.data) return <PanelError label="Country statistics are unavailable." onRetry={() => metrics.refetch()} />;

  const chartData = [
    { name: 'Population', value: metrics.data.population },
    { name: 'Area', value: metrics.data.area },
    { name: 'GDP', value: metrics.data.gdpUsd ?? 0 },
  ];

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Population" value={formatCompact(metrics.data.population)} />
        <Stat label="Density" value={`${metrics.data.density}/km2`} />
        <Stat label="Capital" value={metrics.data.capital || 'Unknown'} />
        <Stat label="Life exp." value={metrics.data.lifeExpectancy ? `${metrics.data.lifeExpectancy} yrs` : 'No data'} />
      </div>
      <div className="h-44 rounded-md border border-slate-200 p-2">
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
      <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-semibold text-ink">Travel snapshot</p>
        <p className="mt-1">
          {place.name} uses {metrics.data.currency || 'local currency'} and drives on the{' '}
          {metrics.data.drivingSide || 'unknown'} side. Internet usage is{' '}
          {metrics.data.internetUsersPct ? `${metrics.data.internetUsersPct}%` : 'not available'}.
          {weather.data
            ? ` Current weather is ${weather.data.condition.text.toLowerCase()}, ${weather.data.temp_c} C.`
            : ''}
        </p>
      </div>
      {weather.data?.hourly?.length ? <WeatherMiniChart weather={weather.data.hourly} /> : null}
    </div>
  );
}

function CompareTab({ place }: { place: PlaceSuggestion }) {
  const favorites = useAppStore((state) => state.favorites);
  const history = useAppStore((state) => state.history);
  const candidates = uniquePlaces([place, ...favorites, ...history]).filter((item) => item.fcode === 'PCLI');
  const [codes, setCodes] = useState<string[]>([place.countryCode, candidates[1]?.countryCode].filter(Boolean));
  const query = useQuery({
    queryKey: ['compare', codes.join(',')],
    queryFn: () => compareCountries(codes),
    enabled: codes.length >= 2,
  });

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <label className="text-xs font-semibold uppercase text-slate-500" htmlFor="compare-select">
          Add country from history
        </label>
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          id="compare-select"
          onChange={(event) => {
            const value = event.target.value;
            if (value && !codes.includes(value)) setCodes((current) => [...current, value].slice(0, 4));
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
            className="rounded-md bg-teal/10 px-3 py-1 text-xs font-semibold text-teal"
            key={code}
            onClick={() => setCodes((current) => current.filter((item) => item !== code))}
            type="button"
          >
            {code} ×
          </button>
        ))}
      </div>
      {codes.length < 2 ? <p className="text-sm text-slate-600">Save or search another country to compare.</p> : null}
      {query.isLoading ? <SkeletonRows /> : null}
      {query.isError ? <PanelError label="Comparison could not be loaded." onRetry={() => query.refetch()} /> : null}
      {query.data ? (
        <div className="grid gap-3">
          {query.data.map((country) => (
            <article className="rounded-md border border-slate-200 p-3" key={country.code}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{country.name}</h3>
                <span className="text-xs text-slate-500">{country.region}</span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <MiniRow label="Population" value={formatCompact(country.population)} />
                <MiniRow label="GDP" value={country.gdpUsd ? `$${formatCompact(country.gdpUsd)}` : 'No data'} />
        <MiniRow label="Life exp." value={country.lifeExpectancy ? `${country.lifeExpectancy}` : 'No data'} />
        <MiniRow label="Internet" value={country.internetUsersPct ? `${country.internetUsersPct}%` : 'No data'} />
        <MiniRow label="Literacy" value={country.literacyPct ? `${country.literacyPct}%` : 'No data'} />
        <MiniRow label="Inflation" value={country.inflationPct ? `${country.inflationPct}%` : 'No data'} />
      </dl>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NearbyTab({ place }: { place: PlaceSuggestion }) {
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
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          onChange={(event) => setCategory(event.target.value as NearbyCategory)}
          value={category}
        >
          {nearbyCategories.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white" onClick={loadNearby} type="button">
          Find
        </button>
      </div>
      {query.isFetching ? <SkeletonRows /> : null}
      {query.isError ? <PanelError label="Nearby places could not be loaded." onRetry={loadNearby} /> : null}
      {query.data?.map((item) => (
        <article className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm" key={item.id}>
          <span className="font-medium">{item.name}</span>
          <span className="text-slate-500">{item.distanceKm} km</span>
        </article>
      ))}
    </div>
  );
}

function RouteTab({ place }: { place: PlaceSuggestion }) {
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
      <select
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        onChange={(event) => setDestinationId(event.target.value)}
        value={destinationId}
      >
        <option value="">Choose destination from history</option>
        {destinations.map((item) => (
          <option key={item.geonameId} value={String(item.geonameId)}>
            {item.name}, {item.countryName}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-3 gap-2">
        {(['driving', 'walking', 'cycling'] as const).map((item) => (
          <button
            className={`rounded-md px-3 py-2 text-sm font-semibold ${profile === item ? 'bg-teal text-white' : 'bg-slate-100'}`}
            key={item}
            onClick={() => setProfile(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <button className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white" onClick={calculate} type="button">
        Calculate route
      </button>
      {flightDistance ? <Stat label="Flight distance" value={`${flightDistance.toFixed(1)} km`} /> : null}
      {query.isFetching ? <SkeletonRows /> : null}
      {query.isError ? <PanelError label="Route could not be calculated. Try another destination or profile." onRetry={calculate} /> : null}
      {query.data ? (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Route distance" value={`${query.data.distanceKm} km`} />
            <Stat label="Travel time" value={formatDuration(query.data.durationMinutes)} />
            <Stat label="Mode" value={query.data.profile} />
            <Stat label="Direct gap" value={`${query.data.flightDistanceKm} km`} />
          </div>
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-sm font-semibold">Directions</p>
            <ol className="mt-2 grid gap-2 text-sm">
              {query.data.steps.slice(0, 8).map((step, index) => (
                <li className="grid grid-cols-[1.5rem_1fr_auto] gap-2" key={`${step.instruction}-${index}`}>
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

function DrawTab() {
  const { drawingMode, drawingDraft, drawings, setDrawingMode, setDrawingDraft, addDrawing, clearDrawings } = useAppStore();

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

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        {(['select', 'marker', 'circle', 'rectangle', 'polygon', 'distance'] as DrawingMode[]).map((mode) => (
          <button
            className={`rounded-md px-2 py-2 text-xs font-semibold ${drawingMode === mode ? 'bg-teal text-white' : 'bg-slate-100'}`}
            key={mode}
            onClick={() => setDrawingMode(mode)}
            type="button"
          >
            {mode}
          </button>
        ))}
      </div>
      <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-semibold text-ink">How drawing works</p>
        <p className="mt-1">
          Marker uses one click. Circle, rectangle, and distance use two clicks. Polygon accepts multiple clicks, then finish it here.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white" onClick={finishPolygon} type="button">
          Finish polygon
        </button>
        <button className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold" onClick={() => setDrawingDraft([])} type="button">
          Clear draft
        </button>
      </div>
      <button className="rounded-md bg-coral px-3 py-2 text-sm font-semibold text-white" onClick={clearDrawings} type="button">
        Clear drawings
      </button>
      <div className="grid gap-2">
        {drawings.map((drawing) => (
          <article className="rounded-md border border-slate-200 p-3 text-sm" key={drawing.id}>
            <p className="font-semibold">{drawing.label}</p>
            <p className="text-slate-500">{drawingSummary(drawing)}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function SavedTab() {
  const { favorites, history, selectedPlace, toggleFavorite, setSelectedPlace, clearHistory } = useAppStore();
  const isFavorite = selectedPlace
    ? favorites.some((item) => item.geonameId === selectedPlace.geonameId)
    : false;

  return (
    <div className="grid gap-4">
      {selectedPlace ? (
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md bg-coral px-3 py-2 text-sm font-semibold text-white"
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
        <button className="text-slate-500 transition hover:text-coral" onClick={clearHistory} type="button">
          <Trash2 className="size-4" />
        </button>
      </div>
      <SavedList icon={Clock} label="History" places={history} onSelect={setSelectedPlace} />
    </div>
  );
}

function ExportTab({ place }: { place: PlaceSuggestion }) {
  const route = useAppStore((state) => state.route);
  const nearbyPlaces = useAppStore((state) => state.nearbyPlaces);
  const drawings = useAppStore((state) => state.drawings);

  return (
    <div className="grid gap-3">
      <button
        className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white"
        onClick={() => downloadJson(`${place.name}-place.json`, place)}
        type="button"
      >
        Export selected place JSON
      </button>
      <button
        className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
        className="rounded-md bg-teal px-3 py-2 text-sm font-semibold text-white"
        onClick={() => printReport(place, nearbyPlaces)}
        type="button"
      >
        Print / save PDF report
      </button>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-md bg-teal px-3 py-2 text-sm font-semibold text-white"
        onClick={() => exportMapImage(place.name)}
        type="button"
      >
        <ImageDown className="size-4" />
        Export map image
      </button>
      <button
        className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!drawings.length}
        onClick={() => downloadJson(`${place.name}-drawings.geojson`, drawingsToGeoJson(drawings))}
        type="button"
      >
        Export drawings GeoJSON
      </button>
      <p className="text-xs text-slate-500">
        PDF uses the browser print dialog. Map image export saves the rendered Leaflet tiles when the browser allows canvas access.
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
  if (!places.length) return <p className="text-sm text-slate-500">No {label.toLowerCase()} yet.</p>;
  return (
    <div className="grid gap-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-teal" /> {label}
      </p>
      {places.map((place) => (
        <button
          className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-left text-sm transition hover:bg-slate-50"
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

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Navigation;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`grid h-14 place-items-center text-xs font-semibold transition ${
        active ? 'bg-white text-teal shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-ink'
      }`}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
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

function EmptyState() {
  return (
    <div className="grid place-items-center py-8 text-center text-slate-500">
      <SearchX className="mb-2 size-8" />
      <p className="text-sm">Search for a place to unlock insights and tools.</p>
    </div>
  );
}

function PanelError({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <div className="grid gap-2 rounded-md bg-coral/10 p-3 text-sm font-semibold text-coral">
      <span>{label}</span>
      {onRetry ? (
        <button className="w-fit rounded-md bg-white px-3 py-1 text-xs text-coral" onClick={onRetry} type="button">
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
        <div className="h-12 animate-pulse rounded-md bg-slate-100" key={item} />
      ))}
    </div>
  );
}

function formatCompact(value: number) {
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatNumber(value: number) {
  return Intl.NumberFormat().format(value);
}

function uniquePlaces(places: PlaceSuggestion[]) {
  return places.filter(
    (place, index, all) => place.countryCode && all.findIndex((item) => item.geonameId === place.geonameId) === index,
  );
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLon = toRad(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  toast.success(`Use the print dialog to save ${name} as PDF, or screenshot the map from the print preview.`);
}

function WeatherMiniChart({
  weather,
}: {
  weather: Array<{ time: string; temp_c: number; humidity: number | null; wind_kph: number | null; rainChance: number | null }>;
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
      <div className="h-40 rounded-md border border-slate-200 p-2">
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

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function drawingSummary(drawing: DrawingFeature) {
  if (drawing.distanceKm) return `${drawing.distanceKm.toFixed(2)} km`;
  if (drawing.radiusKm) return `Radius ${drawing.radiusKm.toFixed(2)} km`;
  if (drawing.areaKm2) return `Area ${drawing.areaKm2.toFixed(2)} km2`;
  return `${drawing.points.length} point${drawing.points.length === 1 ? '' : 's'}`;
}

function polygonAreaKm2(points: Array<[number, number]>) {
  if (points.length < 3) return 0;
  const origin = points[0];
  const projected = points.map(([lat, lng]) => {
    const x = distanceKm(origin[0], origin[1], origin[0], lng) * (lng < origin[1] ? -1 : 1);
    const y = distanceKm(origin[0], origin[1], lat, origin[1]) * (lat < origin[0] ? -1 : 1);
    return [x, y];
  });
  const area = projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  return Math.abs(area / 2);
}

function drawingsToGeoJson(drawings: DrawingFeature[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: drawings.map((drawing) => ({
      type: 'Feature',
      properties: {
        id: drawing.id,
        kind: drawing.kind,
        label: drawing.label,
        radiusKm: drawing.radiusKm,
        distanceKm: drawing.distanceKm,
        areaKm2: drawing.areaKm2,
      },
      geometry: drawingGeometry(drawing),
    })),
  };
}

function drawingGeometry(drawing: DrawingFeature): GeoJSON.Geometry {
  if (drawing.kind === 'marker' || drawing.kind === 'circle') {
    return { type: 'Point', coordinates: [drawing.points[0][1], drawing.points[0][0]] };
  }
  if (drawing.kind === 'rectangle') {
    const [a, b] = drawing.points;
    return {
      type: 'Polygon',
      coordinates: [[[a[1], a[0]], [b[1], a[0]], [b[1], b[0]], [a[1], b[0]], [a[1], a[0]]]],
    };
  }
  if (drawing.kind === 'polygon') {
    const ring = drawing.points.map(([lat, lng]) => [lng, lat]);
    return { type: 'Polygon', coordinates: [[...ring, ring[0]]] };
  }
  return { type: 'LineString', coordinates: drawing.points.map(([lat, lng]) => [lng, lat]) };
}

function printReport(place: PlaceSuggestion, nearbyPlaces: Array<{ name: string; distanceKm: number }>) {
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
          body { font-family: Arial, sans-serif; margin: 32px; color: #151819; }
          h1 { margin-bottom: 4px; }
          dl { display: grid; grid-template-columns: 160px 1fr; gap: 8px; }
          dt { font-weight: 700; }
          li { margin: 4px 0; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(place.name)}</h1>
        <p>${escapeHtml(place.countryName || 'Unknown country')}</p>
        <dl>
          <dt>Feature</dt><dd>${escapeHtml(place.fcode)}</dd>
          <dt>Coordinates</dt><dd>${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}</dd>
          <dt>GeoNames ID</dt><dd>${escapeHtml(String(place.geonameId ?? 'Unavailable'))}</dd>
        </dl>
        <h2>Nearby Places</h2>
        <ul>${nearbyPlaces.map((item) => `<li>${escapeHtml(item.name)} - ${item.distanceKm} km</li>`).join('')}</ul>
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
