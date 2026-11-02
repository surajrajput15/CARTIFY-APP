import { useState, useEffect, useCallback } from 'react';
import { fetchActiveCampaigns } from '../services/campaignsApi';

// Product-level campaign discount: client-side mirror of evaluateCoupon-style
// per-line math so product cards, detail pages and mini-banners agree with the
// server-authoritative checkout. Percentage is computed off the line total and
// capped at maxDiscount; fixed campaigns are excluded here because a flat amount
// is a whole-cart benefit that cannot be shown accurately per-card.
export function campaignLineDiscount(campaign, price) {
  if (!campaign) return 0;
  if (campaign.discountType !== 'percentage') return 0;
  const pct = Number(campaign.discountValue) / 100;
  let d = Math.round(Number(price) * pct * 100) / 100;
  if (campaign.maxDiscount != null) d = Math.min(d, Number(campaign.maxDiscount));
  return d;
}

export function campaignAppliesTo(campaign, product) {
  if (!campaign) return false;
  const cats = campaign.eligibleCategories || [];
  const prods = campaign.eligibleProductIds || [];
  if (cats.length === 0 && prods.length === 0) return true;
  const pid = String(product._id || product.id || '');
  const idHit = prods.some((x) => String(x) === pid);
  const catHit = cats.some((c) => String(c).toLowerCase() === String(product.category || '').toLowerCase());
  return idHit || catHit;
}

// Module-level shared cache and subscriber pool so dozens of ProductCard instances
// share one cached list of campaigns without redundant React states or network queries.
let cachedCampaigns = null;
let inflightCampaignsPromise = null;
const campaignListeners = new Set();

const notifyCampaignListeners = () => {
  campaignListeners.forEach((fn) => {
    try { fn(cachedCampaigns || []); } catch { /* ignore */ }
  });
};

export const clearCampaignsCache = () => {
  cachedCampaigns = null;
  inflightCampaignsPromise = null;
};

// Fetch active campaigns once, derive the best applicable campaign for a product
// (the one with the larger line discount), and expose a stable snapshot.
export const useActiveCampaigns = () => {
  const [campaigns, setCampaigns] = useState(() => cachedCampaigns || []);
  const [loading, setLoading] = useState(() => cachedCampaigns === null);

  const refresh = useCallback(async () => {
    if (inflightCampaignsPromise) {
      return inflightCampaignsPromise;
    }
    setLoading(cachedCampaigns === null);
    inflightCampaignsPromise = (async () => {
      try {
        const { data } = await fetchActiveCampaigns();
        cachedCampaigns = data.campaigns || [];
        notifyCampaignListeners();
        return cachedCampaigns;
      } catch {
        if (!cachedCampaigns) cachedCampaigns = [];
        return cachedCampaigns;
      } finally {
        inflightCampaignsPromise = null;
        setLoading(false);
      }
    })();
    return inflightCampaignsPromise;
  }, []);

  useEffect(() => {
    const onUpdate = (newList) => {
      setCampaigns(newList);
      setLoading(false);
    };
    campaignListeners.add(onUpdate);

    if (cachedCampaigns === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch
      refresh();
    } else {
      setLoading(false);
    }

    return () => {
      campaignListeners.delete(onUpdate);
    };
  }, [refresh]);

  const bestForProduct = useCallback(
    (product) => {
      let best = null;
      let bestD = 0;
      for (const c of campaigns) {
        if (!campaignAppliesTo(c, product)) continue;
        const d = campaignLineDiscount(c, product.price);
        if (d > bestD) { best = c; bestD = d; }
      }
      return bestD > 0 ? { campaign: best, discount: bestD } : null;
    },
    [campaigns]
  );

  const primary = campaigns[0] || null;

  return { campaigns, loading, refresh, bestForProduct, primaryCampaign: primary };
};