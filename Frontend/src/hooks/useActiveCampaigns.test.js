import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  campaignLineDiscount,
  campaignAppliesTo,
  useActiveCampaigns,
  clearCampaignsCache,
} from './useActiveCampaigns';

vi.mock('../services/campaignsApi', () => ({
  fetchActiveCampaigns: vi.fn(),
}));

import { fetchActiveCampaigns } from '../services/campaignsApi';

describe('useActiveCampaigns utility functions', () => {
  it('campaignLineDiscount computes percentage discount correctly', () => {
    const campaign = { discountType: 'percentage', discountValue: 20 };
    expect(campaignLineDiscount(campaign, 1000)).toBe(200);
  });

  it('campaignLineDiscount caps discount at maxDiscount', () => {
    const campaign = { discountType: 'percentage', discountValue: 50, maxDiscount: 150 };
    expect(campaignLineDiscount(campaign, 1000)).toBe(150);
  });

  it('campaignLineDiscount ignores non-percentage campaigns', () => {
    const campaign = { discountType: 'fixed', discountValue: 100 };
    expect(campaignLineDiscount(campaign, 1000)).toBe(0);
    expect(campaignLineDiscount(null, 1000)).toBe(0);
  });

  it('campaignAppliesTo matches category and product id', () => {
    const campaignAll = { eligibleCategories: [], eligibleProductIds: [] };
    expect(campaignAppliesTo(campaignAll, { _id: 'p1', category: 'clothing' })).toBe(true);

    const campaignCat = { eligibleCategories: ['electronics'], eligibleProductIds: [] };
    expect(campaignAppliesTo(campaignCat, { _id: 'p1', category: 'electronics' })).toBe(true);
    expect(campaignAppliesTo(campaignCat, { _id: 'p1', category: 'clothing' })).toBe(false);

    const campaignProd = { eligibleCategories: [], eligibleProductIds: ['p123'] };
    expect(campaignAppliesTo(campaignProd, { _id: 'p123', category: 'clothing' })).toBe(true);
    expect(campaignAppliesTo(campaignProd, { _id: 'p999', category: 'clothing' })).toBe(false);
  });
});

describe('useActiveCampaigns hook', () => {
  beforeEach(() => {
    clearCampaignsCache();
    vi.clearAllMocks();
  });

  it('fetches active campaigns and provides bestForProduct calculation', async () => {
    const mockCampaigns = [
      {
        _id: 'c1',
        title: 'Tech Fest',
        discountType: 'percentage',
        discountValue: 10,
        eligibleCategories: ['electronics'],
        eligibleProductIds: [],
      },
      {
        _id: 'c2',
        title: 'Mega Tech',
        discountType: 'percentage',
        discountValue: 25,
        eligibleCategories: ['electronics'],
        eligibleProductIds: [],
      },
    ];

    fetchActiveCampaigns.mockResolvedValueOnce({
      data: { campaigns: mockCampaigns },
    });

    const { result } = renderHook(() => useActiveCampaigns());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.campaigns).toHaveLength(2);
    expect(result.current.primaryCampaign?._id).toBe('c1');

    const product = { _id: 'p1', category: 'electronics', price: 1000 };
    const best = result.current.bestForProduct(product);
    expect(best).not.toBeNull();
    expect(best.campaign._id).toBe('c2'); // 25% > 10%
    expect(best.discount).toBe(250);
  });

  it('shares cached campaigns between multiple hook instances', async () => {
    const mockCampaigns = [
      { _id: 'c1', title: 'Summer Sale', discountType: 'percentage', discountValue: 15 },
    ];

    fetchActiveCampaigns.mockResolvedValueOnce({
      data: { campaigns: mockCampaigns },
    });

    const { result: firstHook } = renderHook(() => useActiveCampaigns());
    await waitFor(() => expect(firstHook.current.loading).toBe(false));

    // Second hook call should use shared cached data without re-fetching
    const { result: secondHook } = renderHook(() => useActiveCampaigns());
    expect(secondHook.current.loading).toBe(false);
    expect(secondHook.current.campaigns).toHaveLength(1);
    expect(fetchActiveCampaigns).toHaveBeenCalledTimes(1);
  });
});

