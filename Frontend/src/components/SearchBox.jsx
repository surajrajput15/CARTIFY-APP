import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, LayoutGrid, X } from 'lucide-react';
import { fetchProducts } from '../services/productsApi';
import { getRecentSearches, clearRecentSearches } from '../utils/recentSearches';
import { PRODUCT_CATEGORIES } from '../utils/constants';

const DEBOUNCE_MS = 280;
const MAX_RECENT = 6;

const SearchBox = ({ onSearch, mobile = false }) => {
  const [keyword, setKeyword] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState([]);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const seqRef = useRef(0);
  const navigate = useNavigate();

  // Options rendered when the box is opened with no (or little) input:
  // aim to include product hits first, surfacing category suggestions.
  const buildGroups = useCallback((products, term) => {
    const prod = products.map((p) => ({ title: p.title, id: p._id || p.id, type: 'product' }));

    let cats = [];
    if (term) {
      const t = term.toLowerCase();
      cats = PRODUCT_CATEGORIES.filter((c) => c.includes(t) || t.includes(c)).map((c) => ({
        title: `Shop ${c}`, id: `cat-${c}`, type: 'category',
      }));
    }

    let recent = [];
    if (!term) {
      recent = recents.slice(0, MAX_RECENT).map((r) => ({ title: r, id: `recent-${r}`, type: 'recent' }));
      cats = PRODUCT_CATEGORIES.map((c) => ({ title: `Shop ${c}`, id: `cat-${c}`, type: 'category' }));
    }

    return [...prod, ...cats, ...recent];
  }, [recents]);

  const commit = useCallback(
    (term) => {
      const q = (term ?? keyword).trim();
      setOpen(false);
      setFocused(false);
      setActiveIndex(-1);
      if (q) {
        onSearch ? onSearch(q) : navigate(`/?search=${encodeURIComponent(q)}`);
      } else {
        navigate('/');
      }
    },
    [keyword, navigate, onSearch]
  );

  useEffect(() => {
    setRecents(getRecentSearches());
  }, []);

  useEffect(() => {
    const term = keyword.trim();
    if (!term) {
      setLoading(false);
      if (!focused) { setOpen(false); return; }
      setSuggestions(buildGroups([], term));
      setOpen(true);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    const seq = ++seqRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchProducts({ search: term, limit: 6 });
        const list = (res?.data?.products || res?.data || [])
          .filter((p) => p && typeof p.title === 'string')
          .slice(0, 6);
        if (seq !== seqRef.current) return;
        const groups = buildGroups(list, term);
        setSuggestions(groups);
        setOpen(groups.length > 0);
      } catch {
        if (seq !== seqRef.current) return;
        setSuggestions(buildGroups([], term));
        setOpen(true);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      seqRef.current += 1;
    };
    // recents factored into buildGroups via useCallback; keyword/focus drive refetch
  }, [keyword, buildGroups, focused]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
        setFocused(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); setFocused(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const pick = (s) => {
    setOpen(false);
    setFocused(false);
    setActiveIndex(-1);
    if (s.type === 'category') {
      const cat = String(s.title.replace(/^Shop /, '')).toLowerCase();
      navigate(`/?category=${encodeURIComponent(cat)}`);
      return;
    }
    const q = s.title;
    if (s.type !== 'recent') setKeyword(q);
    onSearch ? onSearch(q) : navigate(`/?search=${encodeURIComponent(q)}`);
  };

  const clearRecents = (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearRecentSearches();
    setRecents([]);
    if (!keyword.trim()) setOpen(false);
  };

  const grouped = suggestions.reduce((acc, s) => {
    if (!acc[s.type]) acc[s.type] = [];
    acc[s.type].push(s);
    return acc;
  }, {});

  const groupTitles = { product: 'Products', recent: 'Recent searches', category: 'Categories' };
  const groupOrder = ['product', 'recent', 'category'];

  const listId = mobile ? 'sb-list-mobile' : 'sb-list-desktop';
  const inputId = mobile ? 'sb-input-mobile' : 'sb-input-desktop';
  let flatIndex = -1;

  return (
    <div ref={boxRef} className="relative w-full" role="combobox" aria-haspopup="listbox" aria-expanded={open}>
      <label htmlFor={inputId} className="sr-only">
        Search products
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="text"
        role="searchbox"
        placeholder="Search for products, brands and more..."
        value={keyword}
        onFocus={() => { setFocused(true); setOpen(true); setActiveIndex(-1); }}
        onChange={(e) => { setKeyword(e.target.value); setActiveIndex(-1); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (open && activeIndex >= 0 && suggestions[activeIndex]) {
              pick(suggestions[activeIndex]);
            } else {
              commit();
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (open && suggestions.length) {
              setOpen(true);
              setActiveIndex((prev) => (prev + 1) % suggestions.length);
            }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (open && suggestions.length) {
              setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
            setFocused(false);
            setActiveIndex(-1);
          }
        }}
        className={`w-full pl-4 pr-12 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-gray-50 text-gray-800 ${
          mobile ? 'text-sm' : ''
        }`}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
        }
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => commit()}
        className="absolute right-0 top-0 h-full px-4 text-teal-600 hover:bg-teal-100 rounded-r-lg transition-colors"
        aria-label="Search"
      >
        <Search size={20} aria-hidden="true" />
      </button>
      {loading && (
        <span className="absolute right-12 top-1/2 -translate-y-1/2 text-[10px] text-gray-400" aria-hidden="true">
          Loading…
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-[60] max-h-96 overflow-y-auto"
        >
          {suggestions.map((s) => {
            const idx = ++flatIndex;
            const Icon = s.type === 'recent'
              ? Clock
              : s.type === 'category'
                ? LayoutGrid
                : null;
            return (
              <li key={`${s.type}-${s.id}`} role="option" id={`${listId}-opt-${idx}`} aria-selected={idx === activeIndex}>
                <div
                  className={`flex items-center justify-between px-4 pt-3 pb-0 text-[11px] font-bold uppercase tracking-wide text-gray-400 ${
                    grouped[s.type]?.[0] === s ? '' : 'hidden'
                  }`}
                  aria-hidden="true"
                >
                  {groupTitles[s.type]}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                  className={`w-full text-left px-4 py-3 min-h-[44px] text-sm flex items-center gap-2 transition-colors ${
                    idx === activeIndex ? 'bg-teal-50 text-teal-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {Icon && <Icon size={15} className="text-gray-400 shrink-0" aria-hidden="true" />}
                  <span className="truncate">{s.title}</span>
                </button>
              </li>
            );
          })}
          {grouped.recent?.length > 0 && !keyword.trim() && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearRecents}
                className="w-full text-left px-4 py-2 min-h-[44px] text-xs font-semibold text-gray-500 hover:text-red-500 transition-colors"
              >
                <span className="inline-flex items-center gap-1.5"><X size={13} aria-hidden="true" /> Clear recent searches</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchBox;
