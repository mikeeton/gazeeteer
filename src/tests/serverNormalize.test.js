import { describe, expect, it } from 'vitest';

import { normalizeCountry } from '../../server/index.js';

describe('server country normalization', () => {
  it('prefers rich country metadata when available', () => {
    const country = normalizeCountry(
      {
        countryName: 'United Kingdom',
        countryCode: 'GB',
        isoAlpha3: 'GBR',
        population: '66488991',
        areaInSqKm: '244820',
        capital: 'London',
        currencyCode: 'GBP',
        phone: '44',
      },
      {
        cca2: 'GB',
        cca3: 'GBR',
        name: {
          common: 'United Kingdom',
          official: 'United Kingdom of Great Britain and Northern Ireland',
        },
        capital: ['London'],
        region: 'Europe',
        subregion: 'Northern Europe',
        population: 67000000,
        area: 242900,
        languages: { eng: 'English' },
        currencies: { GBP: { name: 'British pound', symbol: '£' } },
        timezones: ['UTC+00:00'],
        tld: ['.uk'],
        idd: { root: '+4', suffixes: ['4'] },
        car: { side: 'left' },
        flags: { png: 'https://flagcdn.com/w320/gb.png' },
        coatOfArms: { png: 'coat.png' },
        maps: { googleMaps: 'https://maps.example' },
      },
    );

    expect(country.official).toContain('Great Britain');
    expect(country.currencies[0]).toEqual({ code: 'GBP', name: 'British pound', symbol: '£' });
    expect(country.callingCode).toBe('+44');
    expect(country.tld).toEqual(['.uk']);
    expect(country.drivingSide).toBe('left');
    expect(country.timezones).toEqual(['UTC+00:00']);
  });
});
