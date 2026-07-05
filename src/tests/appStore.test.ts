import { beforeEach, describe, expect, it } from 'vitest';

import { useAppStore } from '../store/appStore';
import type { PlaceSuggestion } from '../types/app';

const london: PlaceSuggestion = {
  name: 'London',
  lat: 51.5085,
  lng: -0.1257,
  countryName: 'United Kingdom',
  countryCode: 'GB',
  fcode: 'PPL',
  geonameId: 2643743,
  wikipediaUrl: '',
};

describe('app store persistence features', () => {
  beforeEach(() => {
    useAppStore.setState({
      selectedPlace: null,
      favorites: [],
      history: [],
      nearbyPlaces: [],
      route: null,
      drawings: [],
      drawingDraft: [],
      drawingMode: 'select',
    });
  });

  it('adds selected places to recent history without duplicates', () => {
    useAppStore.getState().setSelectedPlace(london);
    useAppStore.getState().setSelectedPlace(london);

    expect(useAppStore.getState().history).toHaveLength(1);
    expect(useAppStore.getState().history[0].name).toBe('London');
  });

  it('toggles favorites on and off', () => {
    useAppStore.getState().toggleFavorite(london);
    expect(useAppStore.getState().favorites).toHaveLength(1);

    useAppStore.getState().toggleFavorite(london);
    expect(useAppStore.getState().favorites).toHaveLength(0);
  });
});
