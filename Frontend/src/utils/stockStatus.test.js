import { describe, it, expect } from 'vitest';
import { getStockStatus } from './stockStatus';

describe('getStockStatus', () => {
  it('returns null for undefined or null stock', () => {
    expect(getStockStatus(undefined)).toBeNull();
    expect(getStockStatus(null)).toBeNull();
  });

  it('marks out of stock when count <= 0', () => {
    const status = getStockStatus(0);
    expect(status.label).toBe('Out of Stock');
    expect(status.disabled).toBe(true);
  });

  it('marks low stock when count is 1-10', () => {
    const status = getStockStatus(5);
    expect(status.label).toBe('Low Stock');
    expect(status.disabled).toBe(false);
  });

  it('marks in stock when count > 10', () => {
    const status = getStockStatus(20);
    expect(status.label).toBe('In Stock');
    expect(status.disabled).toBe(false);
  });
});