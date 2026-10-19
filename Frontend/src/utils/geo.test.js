import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  haversineKm,
  distanceKm,
  estimateMinutes,
  formatEta,
  timeLabel,
  mapsDeepLink,
  reverseGeocode,
} from './geo';

describe('geo utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('haversineKm and distanceKm', () => {
    it('returns Infinity for empty or missing coordinates', () => {
      expect(haversineKm(null, [28.61, 77.20])).toBe(Infinity);
      expect(haversineKm([28.61, 77.20], null)).toBe(Infinity);
      expect(haversineKm([], [28.61, 77.20])).toBe(Infinity);
      expect(distanceKm(null, null)).toBe(Infinity);
    });

    it('calculates approximate distance between Delhi and Mumbai', () => {
      const delhi = [28.6139, 77.2090];
      const mumbai = [19.0760, 72.8777];
      const dist = distanceKm(delhi, mumbai);
      expect(dist).toBeGreaterThan(1100);
      expect(dist).toBeLessThan(1200);
    });

    it('returns 0 for identical coordinates', () => {
      const point = [12.9716, 77.5946];
      expect(distanceKm(point, point)).toBeCloseTo(0, 1);
    });
  });

  describe('estimateMinutes', () => {
    it('returns null for missing points or non-finite distances', () => {
      expect(estimateMinutes(null, [12, 77])).toBeNull();
      expect(estimateMinutes([12, 77], null)).toBeNull();
    });

    it('estimates reasonable travel minutes with minimum floor', () => {
      const p1 = [12.9716, 77.5946];
      const p2 = [12.9720, 77.5950]; // very close
      expect(estimateMinutes(p1, p2, { minMinutes: 2 })).toBe(2);

      const far = [13.0827, 80.2707]; // Chennai ~290 km
      const mins = estimateMinutes(p1, far, { avgSpeedKmh: 20 });
      expect(mins).toBeGreaterThan(60);
    });
  });

  describe('formatEta', () => {
    it('formats null minutes to estimating', () => {
      expect(formatEta(null)).toBe('Estimating…');
    });

    it('formats minutes below 60', () => {
      expect(formatEta(25)).toBe('25 min');
    });

    it('formats hours and minutes', () => {
      expect(formatEta(60)).toBe('1 hr');
      expect(formatEta(75)).toBe('1 hr 15 min');
      expect(formatEta(150)).toBe('2 hr 30 min');
    });
  });

  describe('timeLabel', () => {
    it('returns empty string for missing iso', () => {
      expect(timeLabel(null)).toBe('');
      expect(timeLabel('')).toBe('');
    });

    it('formats valid ISO date strings to local time', () => {
      const dateStr = '2026-10-19T14:30:00.000Z';
      const label = timeLabel(dateStr);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  describe('mapsDeepLink', () => {
    it('builds a google maps link with custom or default mode', () => {
      expect(mapsDeepLink(28.61, 77.20)).toBe('https://www.google.com/maps/?q=28.61,77.2&mode=d');
      expect(mapsDeepLink(28.61, 77.20, { mode: 'transit' })).toBe('https://www.google.com/maps/?q=28.61,77.2&mode=transit');
    });
  });

  describe('reverseGeocode', () => {
    it('fetches and parses address components from nominatim', async () => {
      const mockResponse = {
        address: {
          house_number: '12',
          road: 'MG Road',
          suburb: 'Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          postcode: '560038',
        },
        display_name: '12, MG Road, Indiranagar, Bengaluru, Karnataka, 560038',
      };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await reverseGeocode(12.97, 77.59);
      expect(res.street).toContain('12, MG Road');
      expect(res.city).toBe('Bengaluru');
      expect(res.state).toBe('Karnataka');
      expect(res.pinCode).toBe('560038');
    });

    it('throws error when fetch response is not ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
      });

      await expect(reverseGeocode(12.97, 77.59)).rejects.toThrow('Reverse geocoding failed');
    });
  });
});
