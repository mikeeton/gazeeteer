import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { MapMode, NearbyPlace, OverlayKey, PlaceSuggestion, RouteSummary } from '../types/app';

type AppState = {
  selectedPlace: PlaceSuggestion | null;
  mapMode: MapMode;
  darkMode: boolean;
  overlays: Record<OverlayKey, boolean>;
  favorites: PlaceSuggestion[];
  history: PlaceSuggestion[];
  nearbyPlaces: NearbyPlace[];
  route: RouteSummary | null;
  setSelectedPlace: (place: PlaceSuggestion | null) => void;
  setMapMode: (mode: MapMode) => void;
  setDarkMode: (enabled: boolean) => void;
  toggleOverlay: (overlay: OverlayKey) => void;
  toggleFavorite: (place: PlaceSuggestion) => void;
  setNearbyPlaces: (places: NearbyPlace[]) => void;
  setRoute: (route: RouteSummary | null) => void;
  clearHistory: () => void;
  resetMap: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedPlace: null,
      mapMode: 'street',
      darkMode: true,
      favorites: [],
      history: [],
      nearbyPlaces: [],
      route: null,
      overlays: {
        airports: false,
        earthquakes: false,
        landmarks: false,
      },
      setSelectedPlace: (place) =>
        set((state) => ({
          selectedPlace: place,
          history: place
            ? [place, ...state.history.filter((item) => item.geonameId !== place.geonameId)].slice(0, 12)
            : state.history,
        })),
      setMapMode: (mode) => set({ mapMode: mode }),
      setDarkMode: (enabled) => set({ darkMode: enabled }),
      toggleOverlay: (overlay) =>
        set((state) => ({
          overlays: { ...state.overlays, [overlay]: !state.overlays[overlay] },
        })),
      toggleFavorite: (place) => {
        const exists = get().favorites.some((item) => item.geonameId === place.geonameId);
        set((state) => ({
          favorites: exists
            ? state.favorites.filter((item) => item.geonameId !== place.geonameId)
            : [place, ...state.favorites].slice(0, 24),
        }));
      },
      setNearbyPlaces: (places) => set({ nearbyPlaces: places }),
      setRoute: (route) => set({ route }),
      clearHistory: () => set({ history: [] }),
      resetMap: () =>
        set({
          selectedPlace: null,
          mapMode: 'street',
          overlays: { airports: false, earthquakes: false, landmarks: false },
        }),
    }),
    {
      name: 'gazetteer-app-state',
      partialize: (state) => ({
        darkMode: state.darkMode,
        favorites: state.favorites,
        history: state.history,
      }),
    },
  ),
);
