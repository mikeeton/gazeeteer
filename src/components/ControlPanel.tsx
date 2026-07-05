import {
  Banknote,
  CalendarDays,
  CloudSun,
  Globe2,
  Home,
  Info,
  Landmark,
  Map,
  Menu,
  Moon,
  Plane,
  Satellite,
  Star,
  Sun,
  Waves,
  BookOpenText,
  CloudLightning,
  Flame,
  Mountain,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { useAppStore } from '../store/appStore';
import type { DetailMode, MapMode, OverlayKey } from '../types/app';
import { featureClasses, featureTypes } from '../constants/featureTypes';

type ControlPanelProps = {
  onOpenDetail: (mode: DetailMode) => void;
};

export function ControlPanel({ onOpenDetail }: ControlPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const {
    selectedPlace,
    mapMode,
    darkMode,
    favorites,
    overlays,
    setMapMode,
    setDarkMode,
    toggleOverlay,
    toggleFavorite,
    resetMap,
  } = useAppStore();
  const selectedIsFavorite = selectedPlace
    ? favorites.some((place) => place.geonameId === selectedPlace.geonameId)
    : false;

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if ((target as Element).closest?.('.control-toggle')) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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
    const featureLabel =
      featureTypes[selectedPlace.fcode] ??
      selectedPlace.fclName ??
      featureClasses[selectedPlace.fcl ?? ''] ??
      selectedPlace.fcode;
    const url = selectedPlace.wikipediaUrl
      ? `https://${selectedPlace.wikipediaUrl}`
      : `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(
          `${selectedPlace.name} ${selectedPlace.countryName} ${featureLabel}`,
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
        aria-label={isOpen ? 'Close map menu' : 'Open map menu'}
        className="control-toggle dark-glass absolute right-4 top-4 z-[1200] grid size-12 place-items-center text-white transition hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-teal/30"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      <aside
        aria-label="Map command menu"
        className={`control-panel dark-glass absolute right-4 top-20 z-[1200] w-[min(92vw,20rem)] overflow-hidden text-white transition duration-200 ${
          isOpen ? 'control-panel-open translate-x-0' : 'control-panel-closed pointer-events-none translate-x-8'
        }`}
        id="map-controls"
        ref={panelRef}
      >
        <div className="border-b border-white/10 bg-white/5 px-4 py-3">
          <p className="ui-section-title text-teal">Map menu</p>
          <h2 className="mt-0.5 text-base font-semibold">Explore controls</h2>
          <p className="mt-1 text-xs text-slate-300">
            {selectedPlace ? `Selected: ${selectedPlace.name}` : 'Search for a place to unlock local tools.'}
          </p>
        </div>

        <div className="control-panel-scroll grid max-h-[min(70vh,43rem)] gap-4 overflow-y-auto p-4">
          <MenuSection title="Map style">
            <div className="grid grid-cols-2 gap-2">
              {mapModes.map(({ key, label, icon: Icon }) => (
                <button className={buttonClass(mapMode === key)} key={key} onClick={() => setMapMode(key)} type="button">
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </MenuSection>

          <MenuSection title="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              <button className={buttonClass(darkMode)} onClick={() => setDarkMode(!darkMode)} type="button">
                {darkMode ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
                Theme
              </button>
              <button
                className={buttonClass(selectedIsFavorite)}
                disabled={!selectedPlace}
                onClick={() => selectedPlace && toggleFavorite(selectedPlace)}
                type="button"
              >
                <Star className="size-4" aria-hidden="true" />
                Save
              </button>
              <button className={buttonClass(false)} onClick={resetMap} type="button">
                <Home className="size-4" aria-hidden="true" />
                Home
              </button>
              <button className={buttonClass(false)} onClick={openWikipedia} type="button">
                <BookOpenText className="size-4" aria-hidden="true" />
                Wiki
              </button>
            </div>
          </MenuSection>

          <MenuSection title="Overlays">
            <div className="grid gap-2">
              {overlayButton('airports', 'Airports', Plane)}
              {overlayButton('earthquakes', 'Earthquakes', Waves)}
              {overlayButton('landmarks', 'Landmarks', Landmark)}
              {overlayButton('wildfires', 'Wildfires', Flame)}
              {overlayButton('volcanoes', 'Volcanoes', Mountain)}
              {overlayButton('storms', 'Storms', CloudLightning)}
              {overlayButton('floods', 'Floods', Waves)}
            </div>
          </MenuSection>

          <MenuSection title="Details">
            <div className="grid gap-2">
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
            </div>
          </MenuSection>

          {selectedPlace ? (
            <p className="flex items-start gap-2 rounded-md border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              <Globe2 className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden="true" />
              <span>
                Active place: <strong className="text-white">{selectedPlace.name}</strong>
              </span>
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
}

const mapModes: Array<{ key: MapMode; label: string; icon: LucideIcon }> = [
  { key: 'street', label: 'Street', icon: Map },
  { key: 'satellite', label: 'Satellite', icon: Satellite },
  { key: 'terrain', label: 'Terrain', icon: Mountain },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'light', label: 'Light', icon: Sun },
];

function buttonClass(active: boolean) {
  return `ui-button ${active ? 'ui-button-active' : 'ui-button-dark'}`;
}

function MenuSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <details className="menu-section grid gap-2" open>
      <summary className="ui-section-title flex cursor-pointer list-none items-center justify-between rounded-md py-1">
        {title}
        <span className="text-slate-500">+</span>
      </summary>
      {children}
    </details>
  );
}
