import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import toast from 'react-hot-toast';

import { searchPlaces } from '../../api/gazetteerApi';
import { featureClasses, featureTypes } from '../../constants/featureTypes';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAppStore } from '../../store/appStore';

export function SearchBox() {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const setSelectedPlace = useAppStore((state) => state.setSelectedPlace);

  const { data = [], isFetching, isError } = useQuery({
    queryKey: ['places', debouncedQuery],
    queryFn: () => searchPlaces(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  useEffect(() => {
    if (isError) toast.error('Place search is unavailable right now.');
  }, [isError]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  const choosePlace = (index: number) => {
    const place = data[index];
    if (!place) return;
    setSelectedPlace(place);
    setQuery(`${place.name}, ${place.countryName}`);
    setIsOpen(false);
  };

  return (
    <section className="search-shell pointer-events-none absolute left-1/2 top-4 z-[1000] w-[min(92vw,34rem)] -translate-x-1/2">
      <div className="pointer-events-auto relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-teal" />
        <input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={isOpen}
          className="search-input h-12 w-full rounded-md border border-white/70 bg-white pl-12 pr-12 text-sm font-semibold text-ink shadow-panel outline-none transition placeholder:text-slate-400 focus:border-teal focus:ring-4 focus:ring-teal/20"
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => data.length > 0 && setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, data.length - 1));
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            }
            if (event.key === 'Enter' && data.length > 0) choosePlace(activeIndex);
          }}
          placeholder="Search any place, city, county, country, airport, river..."
          role="combobox"
          type="search"
          value={query}
        />
        {query ? (
          <button
            aria-label="Clear search"
            className="search-clear absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-ink"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            type="button"
          >
            <X className="size-4" />
          </button>
        ) : null}
        {isFetching ? (
          <span className="absolute right-12 top-1/2 size-4 -translate-y-1/2 rounded-full border-2 border-slate-300 border-t-teal motion-safe:animate-spin" />
        ) : null}

        {isOpen && debouncedQuery.length >= 2 ? (
          <ul
            className="search-results mt-2 max-h-80 overflow-y-auto rounded-md border border-white/10 bg-ink/95 p-1.5 shadow-panel backdrop-blur"
            id={listId}
            role="listbox"
          >
            {data.length === 0 && !isFetching ? (
              <li className="px-4 py-3 text-sm text-slate-300">No matching places found.</li>
            ) : null}
            {data.map((place, index) => (
              <li key={`${place.geonameId}-${place.name}`} role="option">
                <button
                  className={`search-result-button flex w-full items-center justify-between gap-4 rounded-md px-4 py-3 text-left transition hover:bg-white/10 focus:bg-white/10 focus:outline-none ${
                    activeIndex === index ? 'bg-white/10 ring-1 ring-white/10' : ''
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choosePlace(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  type="button"
                >
                  <span className="search-result-main min-w-0">
                    <span className="search-result-title block truncate text-sm font-semibold text-white">{place.name}</span>
                    <span className="search-result-meta mt-0.5 block truncate text-xs text-slate-300">
                      {placeLocationLabel(place)}
                    </span>
                    <span className="search-result-detail mt-1 block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      {coordinateLabel(place)}
                      {place.population ? ` · ${formatCompact(place.population)} people` : ''}
                    </span>
                  </span>
                  <span className="search-result-badge shrink-0 rounded-md bg-gold/10 px-2 py-1 text-xs font-bold text-gold">
                    {featureLabel(place)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function featureLabel(place: { fcode: string; fcl?: string; fclName?: string }) {
  return featureTypes[place.fcode] ?? place.fclName ?? featureClasses[place.fcl ?? ''] ?? place.fcode;
}

function placeLocationLabel(place: {
  adminName1?: string;
  adminName2?: string;
  countryName: string;
  countryCode: string;
}) {
  return [place.adminName2, place.adminName1, place.countryName || place.countryCode].filter(Boolean).join(', ');
}

function coordinateLabel(place: { lat: number; lng: number }) {
  const lat = `${Math.abs(place.lat).toFixed(3)}${place.lat >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(place.lng).toFixed(3)}${place.lng >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}

function formatCompact(value: number) {
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
