const RECENT_KEY = 'cartify_recent_searches';
const MAX = 6;

export const getRecentSearches = () => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s) => typeof s === 'string' && s.trim()).slice(0, MAX)
      : [];
  } catch {
    return [];
  }
};

export const recordSearch = (term) => {
  if (!term || typeof term !== 'string') return;
  const clean = term.trim();
  if (!clean) return;
  try {
    const next = [
      clean,
      ...getRecentSearches().filter((s) => s.toLowerCase() !== clean.toLowerCase()),
    ].slice(0, MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
};

export const clearRecentSearches = () => {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // best-effort
  }
};