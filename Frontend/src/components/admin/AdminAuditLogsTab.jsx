import { useEffect, useState, useCallback, Fragment } from 'react';
import { ScrollText, Download, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchAuditLogs, fetchAuditMeta } from '../../services/auditApi';
import { formatDate } from '../../utils/format';
import Spinner from '../Spinner';

const EMPTY_FILTERS = { user: '', action: '', resource: '', success: '', from: '', to: '' };

// Full history of every audited mutation across the platform (B3): who did
// what, to which resource, when — and whether it succeeded. Rows expand to
// show the sanitized before/after snapshots captured by the audit middleware.
const AdminAuditLogsTab = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [meta, setMeta] = useState({ actions: [], resources: [], roles: [] });
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async (pageNum, activeFilters) => {
    setLoading(true);
    try {
      const params = { page: pageNum, limit: 20 };
      for (const [k, v] of Object.entries(activeFilters)) {
        if (v) params[k] = v;
      }
      const { data } = await fetchAuditLogs(params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPages(data.pages || 0);
      setPage(data.page || 1);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch
    load(1, EMPTY_FILTERS);
    fetchAuditMeta().then(({ data }) => {
      setMeta({ actions: data.actions || [], resources: data.resources || [], roles: data.roles || [] });
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
      const { data } = await fetchAuditLogs(params);
      const rows = data.logs || [];
      if (!rows.length) { toast.error('Nothing to export'); return; }
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [
        'timestamp,userEmail,userRole,action,resource,resourceId,success,errorMessage,ip',
        ...rows.map((l) => [
          l.timestamp, l.userEmail, l.userRole, l.action, l.resource,
          l.resourceId || '', l.success, l.errorMessage || '', l.ip || '',
        ].map(esc).join(',')),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} rows`);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const roleBadge = (role) => {
    const cls = role === 'admin'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : role === 'delivery'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : role === 'warehouse'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-gray-100 text-gray-500 border-gray-200';
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${cls}`}>{role}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ScrollText size={20} className="text-teal-600" aria-hidden="true" /> Audit Logs
          </h2>
          <p className="text-sm text-gray-500">Every admin/staff mutation across products, orders, stock, campaigns and more — {total} entries.</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={exporting || total === 0}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl transition-colors disabled:opacity-50 min-h-[44px]"
        >
          <Download size={16} aria-hidden="true" /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <div className="bg-white rounded-xl border p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="audit-user">User (email or id)</label>
          <input id="audit-user" value={filters.user} onChange={(e) => set('user', e.target.value)} placeholder="admin@…" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="audit-action">Action</label>
          <select id="audit-action" value={filters.action} onChange={(e) => set('action', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">All</option>
            {meta.actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="audit-resource">Resource</label>
          <select id="audit-resource" value={filters.resource} onChange={(e) => set('resource', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">All</option>
            {meta.resources.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="audit-success">Outcome</label>
          <select id="audit-success" value={filters.success} onChange={(e) => set('success', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">All</option>
            <option value="true">Success</option>
            <option value="false">Failed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="audit-from">From</label>
          <input id="audit-from" type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="audit-to">To</label>
          <input id="audit-to" type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div className="col-span-2 md:col-span-3 lg:col-span-6 flex gap-2">
          <button onClick={applyFilters} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl min-h-[44px]">Apply</button>
          <button onClick={clearFilters} className="px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl min-h-[44px]">Clear</button>
        </div>
      </div>

      {loading ? <Spinner /> : logs.length === 0 ? (
        <p className="text-gray-500 text-center py-12 bg-gray-50 rounded-xl border">No audit entries match these filters.</p>
      ) : (
        <>
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 p-3" aria-label="Expand" />
                  <th className="text-left p-3">When</th>
                  <th className="text-left p-3">Who</th>
                  <th className="text-left p-3">Action</th>
                  <th className="text-left p-3">Resource</th>
                  <th className="text-left p-3">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <Fragment key={l._id}>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <button
                          onClick={() => setExpanded((e) => (e === l._id ? null : l._id))}
                          className="p-1.5 hover:bg-gray-100 rounded min-w-[36px] min-h-[36px] inline-flex items-center justify-center"
                          aria-label={expanded === l._id ? 'Collapse details' : 'Expand details'}
                          aria-expanded={expanded === l._id}
                        >
                          {expanded === l._id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="p-3 text-gray-600 whitespace-nowrap">{formatDate(l.timestamp)}</td>
                      <td className="p-3">
                        <p className="font-semibold truncate max-w-[220px]" title={l.userEmail}>{l.userEmail}</p>
                        {roleBadge(l.userRole)}
                      </td>
                      <td className="p-3"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{l.action}</code></td>
                      <td className="p-3 text-gray-600">
                        {l.resource}
                        {l.resourceId && <span className="block text-xs text-gray-400 font-mono">{String(l.resourceId).slice(-8)}</span>}
                      </td>
                      <td className="p-3">
                        {l.success
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">OK</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200" title={l.errorMessage || ''}>Failed</span>}
                      </td>
                    </tr>
                    {expanded === l._id && (
                      <tr className="bg-gray-50/60">
                        <td />
                        <td colSpan={5} className="p-3">
                          <div className="grid md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="font-bold text-gray-500 uppercase mb-1">Request (before)</p>
                              <pre className="bg-white border rounded-lg p-2 overflow-x-auto max-h-48 font-mono">{JSON.stringify(l.before ?? null, null, 2)}</pre>
                            </div>
                            <div>
                              <p className="font-bold text-gray-500 uppercase mb-1">Response (after)</p>
                              <pre className="bg-white border rounded-lg p-2 overflow-x-auto max-h-48 font-mono">{JSON.stringify(l.after ?? null, null, 2)}</pre>
                            </div>
                          </div>
                          {(l.ip || l.errorMessage) && (
                            <p className="text-xs text-gray-400 mt-2">
                              {l.ip && <span className="mr-3">IP: {l.ip}</span>}
                              {l.errorMessage && <span className="text-red-500">Error: {l.errorMessage}</span>}
                            </p>
                          )}
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
              <span className="text-sm text-gray-500">Page {page} of {pages} ({total} entries)</span>
              <button onClick={() => load(page + 1, filters)} disabled={page >= pages} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold disabled:opacity-40 min-h-[44px]">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminAuditLogsTab;
