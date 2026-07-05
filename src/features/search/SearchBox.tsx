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

  const choosePlace = (index: number) => {
    const place = data[index];
    if (!place) return;
    setSelectedPlace(place);
    setQuery(`${place.name}, ${place.countryName}`);
    setIsOpen(false);
  };

  return (
    <section className="pointer-events-none absolute left-1/2 top-4 z-[1000] w-[min(92vw,34rem)] -translate-x-1/2">
      <div className="pointer-events-auto relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        <input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={isOpen}
          className="h-12 w-full rounded-md border border-white/10 bg-white/95 pl-12 pr-12 text-sm font-medium text-ink shadow-panel outline-none transition focus:border-teal focus:ring-4 focus:ring-teal/20"
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => data.length > 0 && setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
            if (event.key === 'Enter' && data.length > 0) choosePlace(0);
          }}
          placeholder="Search any country, county, city, landmark, airport, river, mountain..."
          role="combobox"
          type="search"
          value={query}
        />
        {query ? (
          <button
            aria-label="Clear search"
            className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100"
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
            className="mt-2 max-h-80 overflow-y-auto rounded-md border border-white/10 bg-ink/95 p-1 shadow-panel backdrop-blur"
            id={listId}
            role="listbox"
          >
            {data.length === 0 && !isFetching ? (
              <li className="px-4 py-3 text-sm text-slate-300">No matching places found.</li>
            ) : null}
            {data.map((place, index) => (
              <li key={`${place.geonameId}-${place.name}`} role="option">
                <button
                  className="flex w-full items-center justify-between gap-4 rounded-md px-4 py-3 text-left transition hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choosePlace(index)}
                  type="button"
                >
                  <span>
                    <span className="block text-sm font-semibold text-white">{place.name}</span>
                    <span className="text-xs text-slate-300">{place.countryName}</span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-gold">
                    {featureTypes[place.fcode] ?? place.fclName ?? featureClasses[place.fcl ?? ''] ?? place.fcode}
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
