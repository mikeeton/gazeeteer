import { create } from 'zustand';

import type { MapMode, OverlayKey, PlaceSuggestion } from '../types/app';

type AppState = {
  selectedPlace: PlaceSuggestion | null;
  mapMode: MapMode;
  overlays: Record<OverlayKey, boolean>;
  setSelectedPlace: (place: PlaceSuggestion | null) => void;
  setMapMode: (mode: MapMode) => void;
  toggleOverlay: (overlay: OverlayKey) => void;
  resetMap: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  selectedPlace: null,
  mapMode: 'street',
  overlays: {
    airports: false,
    earthquakes: false,
    landmarks: false,
  },
  setSelectedPlace: (place) => set({ selectedPlace: place }),
  setMapMode: (mode) => set({ mapMode: mode }),
  toggleOverlay: (overlay) =>
    set((state) => ({
      overlays: { ...state.overlays, [overlay]: !state.overlays[overlay] },
    })),
  resetMap: () =>
    set({
      selectedPlace: null,
      mapMode: 'street',
      overlays: { airports: false, earthquakes: false, landmarks: false },
    }),
}));
