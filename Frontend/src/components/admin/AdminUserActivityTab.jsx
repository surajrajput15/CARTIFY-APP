import { useEffect, useState, useCallback, Fragment } from 'react';
import { Activity, Download, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchActivities, fetchActivityMeta } from '../../services/activityApi';
import { formatDate } from '../../utils/format';
import Spinner from '../Spinner';

const EMPTY_FILTERS = { user: '', event: '', from: '', to: '' };

// Behaviour timeline (B4/B5): what every customer actually did — logins, product
// views, cart writes, wishlist, checkout — kept for 90 days. Complements the
// compliance Audit Logs tab (who changed WHAT data) with the user journey view.
const EVENT_STYLES = {
  AUTH_LOGIN: 'bg-blue-50 text-blue-700 border-blue-200',
  AUTH_LOGOUT: 'bg-gray-100 text-gray-600 border-gray-200',
  AUTH_REGISTER: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PRODUCT_VIEW: 'bg-teal-50 text-teal-700 border-teal-200',
  PRODUCT_SEARCH: 'bg-teal-50 text-teal-700 border-teal-200',
  CART_SYNC: 'bg-green-50 text-green-700 border-green-200',
  CART_MERGE: 'bg-green-50 text-green-700 border-green-200',
  CART_CLEAR: 'bg-green-50 text-green-700 border-green-200',
  WISHLIST_ADD: 'bg-pink-50 text-pink-700 border-pink-200',
  WISHLIST_REMOVE: 'bg-pink-50 text-pink-700 border-pink-200',
  CHECKOUT_START: 'bg-amber-50 text-amber-700 border-amber-200',
  CHECKOUT_COMPLETE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CHECKOUT_FAILED: 'bg-red-50 text-red-700 border-red-200',
  PROFILE_UPDATE: 'bg-purple-50 text-purple-700 border-purple-200',
};

const AdminUserActivityTab = () => {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [knownEvents, setKnownEvents] = useState([]);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async (pageNum, activeFilters) => {
    setLoading(true);
    try {
      const params = { page: pageNum, limit: 20 };
      for (const [k, v] of Object.entries(activeFilters)) {
        if (v) params[k] = v;
      }
      const { data } = await fetchActivities(params);
      setEvents(data.events || []);
      setTotal(data.total || 0);
      setPages(data.pages || 0);
      setPage(data.page || 1);
    } catch {
      toast.error('Failed to load user activity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch
    load(1, EMPTY_FILTERS);
    fetchActivityMeta().then(({ data }) => {
      setKnownEvents(data.events || []);
    }).catch(() => {});
  }, [load]);

  const applyFilters = () => {
    setExpanded(null);
    load(1, filters);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setExpanded(null);
    load(1, EMPTY_FILTERS);
  };

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = { page: 1, limit: 500 };
      for (const [k, v] of Object.entries(filters)) {
        if (v) params[k] = v;
      }
      const { data } = await fetchActivities(params);
      const rows = data.events || [];
      if (!rows.length) { toast.error('Nothing to export'); return; }
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [
        'timestamp,userEmail,event,details,ip,userAgent',
        ...rows.map((e) => [
          e.timestamp, e.userEmail || '', e.event,
          e.details ? JSON.stringify(e.details) : '', e.ip || '', e.userAgent || '',
        ].map(esc).join(',')),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-activity-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} rows`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const detailRows = (d) => Object.entries(d || {});

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity size={20} className="text-teal-600" aria-hidden="true" /> User Activity
          </h2>
          <p className="text-sm text-gray-500">What customers actually did — logins, browsing, cart, checkout, wishlist. Kept 90 days.</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={exporting || total === 0}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl transition-colors disabled:opacity-50 min-h-[44px]"
        >
          <Download size={16} aria-hidden="true" /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <div className="bg-white rounded-xl border p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="activity-user">User (email or id)</label>
          <input id="activity-user" value={filters.user} onChange={(e) => set('user', e.target.value)} placeholder="customer@…" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="activity-event">Event</label>
          <select id="activity-event" value={filters.event} onChange={(e) => set('event', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">All</option>
            {knownEvents.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="activity-from">From</label>
            <input id="activity-from" type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="activity-to">To</label>
            <input id="activity-to" type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
        <div className="col-span-2 md:col-span-4 flex gap-2">
          <button onClick={applyFilters} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl min-h-[44px]">Apply</button>
          <button onClick={clearFilters} className="px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl min-h-[44px]">Clear</button>
        </div>
      </div>

      {loading ? <Spinner /> : events.length === 0 ? (
        <p className="text-gray-500 text-center py-12 bg-gray-50 rounded-xl border">No activity matches these filters.</p>
      ) : (
        <>
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 p-3" aria-label="Expand" />
                  <th className="text-left p-3">When</th>
                  <th className="text-left p-3">User</th>
                  <th className="text-left p-3">Event</th>
                  <th className="text-left p-3">Context</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <Fragment key={e._id}>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <button
                          onClick={() => setExpanded((x) => (x === e._id ? null : e._id))}
                          className="p-1.5 hover:bg-gray-100 rounded min-w-[36px] min-h-[36px] inline-flex items-center justify-center"
                          aria-label={expanded === e._id ? 'Collapse details' : 'Expand details'}
                          aria-expanded={expanded === e._id}
                        >
                          {expanded === e._id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="p-3 text-gray-600 whitespace-nowrap">{formatDate(e.timestamp)}</td>
                      <td className="p-3">
                        <p className="font-semibold truncate max-w-[220px]" title={e.userEmail}>{e.userEmail || '—'}</p>
                        {e.userId && (
                          <span className="block text-xs text-gray-400 font-mono">{(e.userId._id || e.userId).slice ? String(e.userId._id || e.userId).slice(-8) : ''}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${EVENT_STYLES[e.event] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {e.event}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 text-xs">
                        {e.details
                          ? <span className="font-mono">{Object.entries(e.details).map(([k, v]) => `${k}: ${v}`).join(', ')}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                    {expanded === e._id && (
                      <tr className="bg-gray-50/60">
                        <td />
                        <td colSpan={4} className="p-3">
                          <div className="text-xs space-y-1.5">
                            {e.details && detailRows(e.details).length > 0 && (
                              <div>
                                <p className="font-bold text-gray-500 uppercase mb-1">Details</p>
                                <pre className="bg-white border rounded-lg p-2 overflow-x-auto max-h-48 font-mono">{JSON.stringify(e.details, null, 2)}</pre>
                              </div>
                            )}
                            {(e.ip || e.userAgent) && (
                              <p className="text-gray-400">
                                {e.ip && <span className="mr-3">IP: {e.ip}</span>}
                                {e.userAgent && <span>Device: {e.userAgent.slice(0, 90)}</span>}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => load(page - 1, filters)} disabled={page <= 1} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold disabled:opacity-40 min-h-[44px]">← Prev</button>
              <span className="text-sm text-gray-500">Page {page} of {pages} ({total} events)</span>
              <button onClick={() => load(page + 1, filters)} disabled={page >= pages} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold disabled:opacity-40 min-h-[44px]">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminUserActivityTab;