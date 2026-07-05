import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DrawingFeature, DrawingMode, MapMode, NearbyPlace, OverlayKey, PlaceSuggestion, RouteSummary } from '../types/app';

type AppState = {
  selectedPlace: PlaceSuggestion | null;
  mapMode: MapMode;
  darkMode: boolean;
  overlays: Record<OverlayKey, boolean>;
  favorites: PlaceSuggestion[];
  history: PlaceSuggestion[];
  nearbyPlaces: NearbyPlace[];
  route: RouteSummary | null;
  drawingMode: DrawingMode;
  drawingDraft: Array<[number, number]>;
  drawings: DrawingFeature[];
  setSelectedPlace: (place: PlaceSuggestion | null) => void;
  setMapMode: (mode: MapMode) => void;
  setDarkMode: (enabled: boolean) => void;
  toggleOverlay: (overlay: OverlayKey) => void;
  toggleFavorite: (place: PlaceSuggestion) => void;
  setNearbyPlaces: (places: NearbyPlace[]) => void;
  setRoute: (route: RouteSummary | null) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  setDrawingDraft: (points: Array<[number, number]>) => void;
  addDrawing: (feature: DrawingFeature) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;
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
      drawingMode: 'select',
      drawingDraft: [],
      drawings: [],
      overlays: {
        airports: false,
        earthquakes: false,
        landmarks: false,
        wildfires: false,
        volcanoes: false,
        storms: false,
        floods: false,
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
      setDrawingMode: (mode) => set({ drawingMode: mode, drawingDraft: [] }),
      setDrawingDraft: (points) => set({ drawingDraft: points }),
      addDrawing: (feature) =>
        set((state) => ({
          drawings: [feature, ...state.drawings].slice(0, 48),
          drawingDraft: [],
        })),
      removeDrawing: (id) => set((state) => ({ drawings: state.drawings.filter((item) => item.id !== id) })),
      clearDrawings: () => set({ drawings: [], drawingDraft: [] }),
      clearHistory: () => set({ history: [] }),
      resetMap: () =>
        set({
          selectedPlace: null,
          mapMode: 'street',
          overlays: {
            airports: false,
            earthquakes: false,
            landmarks: false,
            wildfires: false,
            volcanoes: false,
            storms: false,
            floods: false,
          },
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
