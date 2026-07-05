import { expect, test } from '@playwright/test';

const places = [
  {
    name: 'France',
    lat: 46.2276,
    lng: 2.2137,
    countryName: 'France',
    countryCode: 'FR',
    fcode: 'PCLI',
    fcl: 'A',
    fclName: 'country',
    geonameId: 3017382,
    wikipediaUrl: 'en.wikipedia.org/wiki/France',
    population: 68000000,
  },
  {
    name: 'Paris',
    lat: 48.8566,
    lng: 2.3522,
    countryName: 'France',
    countryCode: 'FR',
    fcode: 'PPLC',
    fcl: 'P',
    fclName: 'capital of a political entity',
    geonameId: 2988507,
    wikipediaUrl: 'en.wikipedia.org/wiki/Paris',
    population: 2100000,
  },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/places**', (route) => route.fulfill({ json: { geonames: places } }));
  await page.route('**/api/countries/FR/metrics', (route) =>
    route.fulfill({
      json: {
        code: 'FR',
        name: 'France',
        population: 68000000,
        area: 551695,
        density: 123.3,
        capital: 'Paris',
        region: 'Europe',
        currency: 'EUR',
        languages: 'French',
        timezones: 'Europe/Paris',
        callingCode: '+33',
        internetDomain: '.fr',
        drivingSide: 'right',
        gdpUsd: 3000000000000,
        lifeExpectancy: 82.4,
        internetUsersPct: 86,
        co2PerCapita: 4.5,
        literacyPct: 99,
        inflationPct: 3.1,
      },
    }),
  );
  await page.route('**/api/weather**', (route) =>
    route.fulfill({
      json: {
        condition: { text: 'Sunny', icon: '//example.com/weather.png' },
        temp_c: 21,
        humidity: 55,
        astro: { sunrise: '06:00 AM', sunset: '09:00 PM' },
        forecast: { forecastday: [] },
      },
    }),
  );
  await page.route('**/api/nearby**', (route) =>
    route.fulfill({
      json: {
        places: [{ id: '1', name: 'Cafe Central', category: 'cafes', lat: 48.85, lng: 2.35, distanceKm: 0.4 }],
      },
    }),
  );
  await page.route('**/api/route**', (route) =>
    route.fulfill({
      json: {
        distanceKm: 12,
        durationMinutes: 28,
        profile: 'driving',
        flightDistanceKm: 10.5,
        summary: 'Paris to France',
        steps: [{ instruction: 'Start on Rue de Test', distanceKm: 1.2, durationMinutes: 3, name: 'Rue de Test' }],
        geometry: { type: 'LineString', coordinates: [[2.21, 46.22], [2.35, 48.85]] },
      },
    }),
  );
});

test('searches, selects, saves, and shows insights', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').fill('France');
  await page.getByRole('option').first().click();

  await expect(page.getByText('Selected:')).toBeVisible();
  await expect(page.getByText('68M')).toBeVisible();

  await page.getByRole('button', { name: /toggle map controls/i }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /saved/i }).click();
  await expect(page.getByText('Favorites')).toBeVisible();
});

test('loads nearby places', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').fill('Paris');
  await page.getByRole('option').nth(1).click();
  await page.getByRole('button', { name: /nearby/i }).click();
  await page.getByRole('button', { name: /^find$/i }).click();
  await expect(page.getByText('Cafe Central')).toBeVisible();
});

test('calculates route from history', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox').fill('France');
  await page.getByRole('option').first().click();
  await page.getByRole('combobox').fill('Paris');
  await page.getByRole('option').nth(1).click();
  await page.getByRole('button', { name: /route/i }).click();
  await page.getByRole('button', { name: /calculate route/i }).click();
  await expect(page.getByText('Route distance')).toBeVisible();
  await expect(page.getByText('12 km')).toBeVisible();
  await expect(page.getByText('Directions')).toBeVisible();
  await expect(page.getByText('Start on Rue de Test')).toBeVisible();
});
