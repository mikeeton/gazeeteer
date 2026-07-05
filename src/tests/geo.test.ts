import { describe, expect, it } from 'vitest';

import { haversineKm } from '../utils/geo';

describe('haversineKm', () => {
  it('calculates a realistic distance between London and Paris', () => {
    const distance = haversineKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(distance).toBeGreaterThan(330);
    expect(distance).toBeLessThan(360);
  });
});
