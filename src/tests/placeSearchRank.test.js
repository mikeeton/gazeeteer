import { describe, expect, it } from 'vitest';

import { comparePlaceSearchResults, normalizePlace, rankPlaceSearchResults, relevanceRank } from '../../server/index.js';

describe('place search ranking', () => {
  it('treats accented names and alternate names as exact matches', () => {
    const place = normalizePlace({
      name: 'München',
      alternateNames: [{ name: 'Munich' }, { name: 'Muenchen' }],
      lat: '48.137',
      lng: '11.575',
      countryName: 'Germany',
      countryCode: 'DE',
      fcode: 'PPLA',
      fcl: 'P',
      population: '1260391',
    });

    expect(relevanceRank('Munich', place)).toBeLessThan(1);
    expect(relevanceRank('Munchen', place)).toBeLessThan(1);
  });

  it('keeps exact populated places above vague contains matches', () => {
    const results = [
      normalizePlace({
        name: 'Little Paris Church',
        lat: '39',
        lng: '-84',
        countryName: 'United States',
        countryCode: 'US',
        fcode: 'CH',
        fcl: 'S',
        population: '0',
      }),
      normalizePlace({
        name: 'Paris',
        lat: '48.8566',
        lng: '2.3522',
        countryName: 'France',
        countryCode: 'FR',
        fcode: 'PPLC',
        fcl: 'P',
        population: '2138551',
      }),
    ].sort((a, b) => comparePlaceSearchResults('paris', a, b));

    expect(results[0].name).toBe('Paris');
    expect(results[0].countryCode).toBe('FR');
  });

  it('uses population as a tie-breaker for duplicate city names', () => {
    const results = [
      normalizePlace({
        name: 'London',
        lat: '42.9834',
        lng: '-81.233',
        countryName: 'Canada',
        countryCode: 'CA',
        fcode: 'PPLA2',
        fcl: 'P',
        population: '383822',
      }),
      normalizePlace({
        name: 'London',
        lat: '51.5074',
        lng: '-0.1278',
        countryName: 'United Kingdom',
        countryCode: 'GB',
        fcode: 'PPLC',
        fcl: 'P',
        population: '8961989',
      }),
    ].sort((a, b) => comparePlaceSearchResults('london', a, b));

    expect(results[0].countryCode).toBe('GB');
    expect(results[1].countryCode).toBe('CA');
  });

  it('does not treat longer unrelated words as matches', () => {
    const paris = normalizePlace({
      name: 'Paris',
      lat: '48.8566',
      lng: '2.3522',
      countryName: 'France',
      countryCode: 'FR',
      fcode: 'PPLC',
      fcl: 'P',
      population: '2138551',
    });
    const parish = normalizePlace({
      name: 'Saint Catherine Parish',
      lat: '18',
      lng: '-77',
      countryName: 'Jamaica',
      countryCode: 'JM',
      fcode: 'ADM1',
      fcl: 'A',
      population: '529218',
    });

    expect(relevanceRank('paris', paris)).toBeLessThan(relevanceRank('paris', parish));
  });

  it('drops vague filler results when enough strong matches exist', () => {
    const results = rankPlaceSearchResults('paris', [
      normalizePlace({
        name: 'Paris',
        lat: '48.8566',
        lng: '2.3522',
        countryName: 'France',
        countryCode: 'FR',
        fcode: 'PPLC',
        fcl: 'P',
        population: '2138551',
      }),
      normalizePlace({
        name: 'Paris, TX Micro Area',
        lat: '33.66',
        lng: '-95.55',
        countryName: 'United States',
        countryCode: 'US',
        fcode: 'RGNE',
        fcl: 'L',
        population: '50000',
      }),
      normalizePlace({
        name: 'Paris 15 Vaugirard',
        lat: '48.84',
        lng: '2.29',
        countryName: 'France',
        countryCode: 'FR',
        fcode: 'PPL',
        fcl: 'P',
        population: '0',
      }),
      normalizePlace({
        name: 'Ancienne rue de Paris',
        lat: '50.6',
        lng: '3.1',
        countryName: 'France',
        countryCode: 'FR',
        fcode: 'RDA',
        fcl: 'R',
        population: '0',
      }),
    ]);

    expect(results.map((place) => place.name)).not.toContain('Ancienne rue de Paris');
  });

  it('surfaces iconic geographic features above tiny duplicate settlements', () => {
    const results = rankPlaceSearchResults('everest', [
      normalizePlace({
        name: 'Everest',
        lat: '39.67',
        lng: '-95.42',
        countryName: 'United States',
        countryCode: 'US',
        fcode: 'PPL',
        fcl: 'P',
        population: '280',
      }),
      normalizePlace({
        name: 'Mount Everest',
        lat: '27.99',
        lng: '86.92',
        countryName: 'Nepal',
        countryCode: 'NP',
        fcode: 'MT',
        fcl: 'T',
        population: '0',
      }),
    ]);

    expect(results[0].name).toBe('Mount Everest');
  });
});
