import {
  Banknote,
  CalendarDays,
  CloudSun,
  Globe2,
  Home,
  Info,
  Layers,
  Landmark,
  Map,
  Plane,
  Satellite,
  Waves,
  Wikipedia,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { useAppStore } from '../store/appStore';
import type { DetailMode, OverlayKey } from '../types/app';

type ControlPanelProps = {
  onOpenDetail: (mode: DetailMode) => void;
};

export function ControlPanel({ onOpenDetail }: ControlPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { selectedPlace, mapMode, overlays, setMapMode, toggleOverlay, resetMap } = useAppStore();

  const requirePlace = () => {
    if (selectedPlace) return true;
    toast.error('Select a place first.');
    return false;
  };

  const openDetail = (mode: DetailMode) => {
    if (!requirePlace()) return;
    if ((mode === 'weather' || mode === 'forecast') && selectedPlace?.fcode === 'PCLI') {
      toast.error('Weather data is available for regions, counties, and towns.');
      return;
    }
    onOpenDetail(mode);
  };

  const openWikipedia = () => {
    if (!requirePlace() || !selectedPlace) return;
    const url = selectedPlace.wikipediaUrl
      ? `https://${selectedPlace.wikipediaUrl}`
      : `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(
          `${selectedPlace.name}, ${selectedPlace.countryName}`,
        )}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const overlayButton = (key: OverlayKey, label: string, Icon: LucideIcon) => (
    <button
      aria-pressed={overlays[key]}
      className={buttonClass(overlays[key])}
      onClick={() => {
        if (key !== 'earthquakes' && !requirePlace()) return;
        toggleOverlay(key);
      }}
      type="button"
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <>
      <button
        aria-controls="map-controls"
        aria-expanded={isOpen}
        aria-label="Toggle map controls"
        className="absolute right-4 top-4 z-[1000] grid size-12 place-items-center rounded-md bg-ink/90 text-white shadow-panel backdrop-blur transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-teal/30"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <Layers className="size-5" />
      </button>

      <aside
        className={`absolute right-4 top-20 z-[1000] w-[min(92vw,18rem)] rounded-md border border-white/10 bg-ink/90 p-4 text-white shadow-panel backdrop-blur transition duration-200 ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0 pointer-events-none'
        }`}
        id="map-controls"
      >
        <div className="grid grid-cols-2 gap-2">
          <button className={buttonClass(mapMode === 'street')} onClick={() => setMapMode('street')} type="button">
            <Map className="size-4" aria-hidden="true" />
            Street
          </button>
          <button
            className={buttonClass(mapMode === 'satellite')}
            onClick={() => setMapMode('satellite')}
            type="button"
          >
            <Satellite className="size-4" aria-hidden="true" />
            Satellite
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          {overlayButton('airports', 'Airports', Plane)}
          {overlayButton('earthquakes', 'Earthquakes', Waves)}
          {overlayButton('landmarks', 'Landmarks', Landmark)}
        </div>

        <div className="mt-4 grid gap-2 border-t border-white/10 pt-4">
          <button className={buttonClass(false)} onClick={resetMap} type="button">
            <Home className="size-4" aria-hidden="true" />
            Home
          </button>
          <button className={buttonClass(false)} onClick={() => openDetail('place')} type="button">
            <Info className="size-4" aria-hidden="true" />
            Place info
          </button>
          <button className={buttonClass(false)} onClick={() => openDetail('currency')} type="button">
            <Banknote className="size-4" aria-hidden="true" />
            Currency
          </button>
          <button className={buttonClass(false)} onClick={() => openDetail('weather')} type="button">
            <CloudSun className="size-4" aria-hidden="true" />
            Weather
          </button>
          <button className={buttonClass(false)} onClick={() => openDetail('forecast')} type="button">
            <CalendarDays className="size-4" aria-hidden="true" />
            Forecast
          </button>
          <button className={buttonClass(false)} onClick={openWikipedia} type="button">
            <Wikipedia className="size-4" aria-hidden="true" />
            Wikipedia
          </button>
        </div>

        {selectedPlace ? (
          <p className="mt-4 flex items-start gap-2 text-xs text-slate-300">
            <Globe2 className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden="true" />
            <span>
              Selected: <strong className="text-white">{selectedPlace.name}</strong>
            </span>
          </p>
        ) : null}
      </aside>
    </>
  );
}

function buttonClass(active: boolean) {
  return `inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-teal/30 ${
    active ? 'bg-teal text-white' : 'bg-white/10 text-slate-100 hover:bg-white/20'
  }`;
}
