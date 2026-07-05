import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Banknote, CalendarDays, CloudSun, Globe2, Loader2, X } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { getCountryInfo, getCurrencyInfo, getWeather } from '../api/gazetteerApi';
import { featureTypes } from '../constants/featureTypes';
import { useAppStore } from '../store/appStore';
import type { DetailMode } from '../types/app';
import { flagUrl } from '../utils/geo';

type DetailModalProps = {
  mode: DetailMode;
  onClose: () => void;
};

export function DetailModal({ mode, onClose }: DetailModalProps) {
  const selectedPlace = useAppStore((state) => state.selectedPlace);

  if (!selectedPlace) return null;

  const title = {
    place: 'Place information',
    currency: 'Currency',
    weather: 'Current weather',
    forecast: '3-day forecast',
  }[mode];

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[2000] grid place-items-center bg-ink/45 px-4 backdrop-blur-sm"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onMouseDown={onClose}
      role="presentation"
    >
      <motion.section
        animate={{ y: 0, opacity: 1 }}
        aria-labelledby="detail-modal-title"
        className="max-h-[86vh] w-[min(94vw,42rem)] overflow-hidden rounded-md bg-white text-ink shadow-panel"
        exit={{ y: 16, opacity: 0 }}
        initial={{ y: 16, opacity: 0 }}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-mist px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">{title}</p>
            <h2 className="truncate text-lg font-semibold" id="detail-modal-title">
              {selectedPlace.name}, {selectedPlace.countryName}
            </h2>
          </div>
          <img
            alt={`${selectedPlace.countryName} flag`}
            className="h-8 w-12 rounded-sm object-cover shadow-sm"
            src={flagUrl(selectedPlace.countryCode, 80)}
          />
          <button
            aria-label="Close details"
            className="grid size-9 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-200 hover:text-ink"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {mode === 'place' ? <PlaceDetails /> : null}
          {mode === 'currency' ? <CurrencyDetails /> : null}
          {mode === 'weather' ? <WeatherDetails /> : null}
          {mode === 'forecast' ? <ForecastDetails /> : null}
        </div>
      </motion.section>
    </motion.div>
  );
}

function PlaceDetails() {
  const selectedPlace = useAppStore((state) => state.selectedPlace)!;
  const { data, isLoading, isError } = useQuery({
    queryKey: ['country', selectedPlace.countryCode],
    queryFn: () => getCountryInfo(selectedPlace.countryCode),
  });

  if (isLoading) return <LoadingState label="Loading place details" />;
  if (isError || !data) return <ErrorState label="Country information could not be loaded." />;

  const currency = data.currencies[0];
  const rows = [
    ['Official name', data.official],
    ['Feature', featureTypes[selectedPlace.fcode] ?? selectedPlace.fcode],
    ['Capital', data.capital || 'Not available'],
    ['Region', [data.region, data.subregion].filter(Boolean).join(', ')],
    ['Population', data.population.toLocaleString()],
    ['Languages', data.languages.join(', ') || 'Not available'],
    ['Timezone', data.timezones?.[0] ?? 'Not available'],
    ['Coordinates', `${selectedPlace.lat.toFixed(4)}, ${selectedPlace.lng.toFixed(4)}`],
    ['Currency', currency ? `${currency.name} (${currency.code})` : 'Not available'],
  ];

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_9rem]">
      <InfoRows rows={rows} />
      {data.coat ? <img alt={`${data.name} coat of arms`} className="mx-auto max-h-32 object-contain" src={data.coat} /> : null}
    </div>
  );
}

function CurrencyDetails() {
  const selectedPlace = useAppStore((state) => state.selectedPlace)!;
  const { data, isLoading, isError } = useQuery({
    queryKey: ['currency', selectedPlace.countryCode],
    queryFn: () => getCurrencyInfo(selectedPlace.countryCode),
  });

  if (isLoading) return <LoadingState label="Loading currency data" />;
  if (isError || !data) return <ErrorState label="Currency information could not be loaded." />;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric icon={Banknote} label="Currency" value={data.currency} />
      <Metric label="Name" value={data.name} />
      <Metric label="USD rate" value={data.rate ? `1 USD = ${data.rate.toFixed(2)} ${data.currency}` : 'Unavailable'} />
    </div>
  );
}

function WeatherDetails() {
  const selectedPlace = useAppStore((state) => state.selectedPlace)!;
  const { data, isLoading, isError } = useQuery({
    queryKey: ['weather', selectedPlace.lat, selectedPlace.lng, 3],
    queryFn: () => getWeather(selectedPlace.lat, selectedPlace.lng, 3),
  });

  if (isLoading) return <LoadingState label="Loading weather" />;
  if (isError || !data) return <ErrorState label="Weather could not be loaded." />;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Metric icon={CloudSun} label="Condition" value={data.condition.text} />
      <Metric label="Temperature" value={`${data.temp_c} C`} />
      <Metric label="Humidity" value={`${data.humidity}%`} />
      <Metric label="Sunrise" value={data.astro.sunrise} />
      <Metric label="Sunset" value={data.astro.sunset} />
    </div>
  );
}

function ForecastDetails() {
  const selectedPlace = useAppStore((state) => state.selectedPlace)!;
  const { data, isLoading, isError } = useQuery({
    queryKey: ['forecast', selectedPlace.lat, selectedPlace.lng],
    queryFn: () => getWeather(selectedPlace.lat, selectedPlace.lng, 3),
  });

  if (isLoading) return <LoadingState label="Loading forecast" />;
  if (isError || !data?.forecast.forecastday.length) return <ErrorState label="Forecast could not be loaded." />;

  const chartData = data.forecast.forecastday.map((day) => ({
    date: new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' }),
    max: day.day.maxtemp_c,
    min: day.day.mintemp_c,
  }));

  return (
    <div className="grid gap-5">
      <div className="h-56">
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart data={chartData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Area dataKey="max" fill="#e76f51" fillOpacity={0.24} stroke="#e76f51" type="monotone" />
            <Area dataKey="min" fill="#0f8b8d" fillOpacity={0.18} stroke="#0f8b8d" type="monotone" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {data.forecast.forecastday.map((day) => (
          <article className="rounded-md border border-slate-200 p-4" key={day.date}>
            <h3 className="font-semibold">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'long' })}</h3>
            <img alt="" className="my-2 h-12 w-12" src={`https:${day.day.condition.icon}`} />
            <p className="text-sm text-slate-600">{day.day.condition.text}</p>
            <p className="mt-2 text-sm">High {day.day.maxtemp_c} C</p>
            <p className="text-sm">Low {day.day.mintemp_c} C</p>
            <p className="text-sm">Rain {day.day.daily_chance_of_rain}%</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function InfoRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="divide-y divide-slate-200 rounded-md border border-slate-200">
      {rows.map(([label, value]) => (
        <div className="grid grid-cols-[8rem_1fr] gap-4 px-4 py-3 text-sm" key={label}>
          <dt className="font-semibold text-slate-600">{label}</dt>
          <dd className="min-w-0 break-words text-right font-medium text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Metric({
  icon: Icon = Globe2,
  label,
  value,
}: {
  icon?: typeof Globe2;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-md border border-slate-200 p-4">
      <Icon className="mb-3 size-5 text-teal" aria-hidden="true" />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-lg font-semibold">{value}</p>
    </article>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-600">
      <Loader2 className="size-5 animate-spin text-teal" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function ErrorState({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-coral/30 bg-coral/10 p-4 text-sm font-medium text-coral">
      {label}
    </div>
  );
}
