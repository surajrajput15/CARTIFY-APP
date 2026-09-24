import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Calendar, TrendingUp, ShoppingCart, Users, Package, Truck, AlertTriangle, DollarSign, BarChart2, PieChart } from 'lucide-react';
import toast from 'react-hot-toast';
import { loadControlSnapshot, fetchCtrlStats, fetchCtrlCharts } from '../../services/controlApi';
import { isNetworkError } from '../../utils/apiError';
import { formatPrice } from '../../utils/format';

const METRICS = [
    { key: 'revenue', label: 'Total Revenue', icon: DollarSign, color: 'text-teal-600 bg-teal-50', format: v => formatPrice(v) },
    { key: 'todayRevenue', label: 'Today Revenue', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50', format: v => formatPrice(v) },
    { key: 'totalOrders', label: 'Total Orders', icon: ShoppingCart, color: 'text-blue-600 bg-blue-50', format: v => v.toLocaleString() },
    { key: 'todayOrders', label: 'Today Orders', icon: ShoppingCart, color: 'text-indigo-600 bg-indigo-50', format: v => v.toLocaleString() },
    { key: 'totalUsers', label: 'Total Customers', icon: Users, color: 'text-purple-600 bg-purple-50', format: v => v.toLocaleString() },
    { key: 'totalProducts', label: 'Total Products', icon: Package, color: 'text-amber-600 bg-amber-50', format: v => v.toLocaleString() },
    { key: 'activeDeliveries', label: 'Active Deliveries', icon: Truck, color: 'text-rose-600 bg-rose-50', format: v => v.toLocaleString() },
    { key: 'lowStockCount', label: 'Low Stock Items', icon: AlertTriangle, color: 'text-orange-600 bg-orange-50', format: v => v.toLocaleString() },
];

function MetricCard({ metric, value }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{metric.label}</span>
                <metric.icon size={20} className={metric.color.replace('bg-', 'text-')} />
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{metric.format(value)}</p>
        </div>
    );
}

function ChartCard({ title, children }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-4">{title}</h3>
            <div className="h-64">{children}</div>
        </div>
    );
}

export default function AdminAnalyticsTab() {
    const [snap, setSnap] = useState(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState(30);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await loadControlSnapshot({ range });
            setSnap({ stats: res.stats?.data, charts: res.charts?.data, delivery: res.delivery?.data });
        } catch (err) {
            if (!isNetworkError(err)) toast.error('Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => { load(); }, [load]);

    const stats = snap?.stats || {};
    const charts = snap?.charts || {};

    const renderRevenueChart = () => {
        const data = charts.revenueSeries || [];
        if (!data.length) return <div className="flex items-center justify-center h-full text-gray-400">No revenue data for this period</div>;
        const maxRev = Math.max(...data.map(d => d.revenue));
        return (
            <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0d9488" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path
                    d={data.map((d, i) => {
                        const x = (i / (data.length - 1 || 1)) * 100;
                        const y = 100 - (d.revenue / (maxRev || 1)) * 80;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ')}
                    stroke="#0d9488" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"
                />
                <path
                    d={data.map((d, i) => {
                        const x = (i / (data.length - 1 || 1)) * 100;
                        const y = 100 - (d.revenue / (maxRev || 1)) * 80;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ')}
                    stroke="none" fill="url(#revGrad)"
                />
            </svg>
        );
    };

    const renderStatusChart = () => {
        const data = charts.statusSeries || [];
        if (!data.length) return <div className="flex items-center justify-center h-full text-gray-400">No order status data</div>;
        const days = [...new Set(data.map(d => d._id.day))].sort();
        const statuses = [...new Set(data.map(d => d._id.status))];
        const colors = { Pending: '#f59e0b', Confirmed: '#3b82f6', Processing: '#8b5cf6', Packed: '#06b6d4', Shipped: '#14b8a6', 'Out for Delivery': '#f97316', Delivered: '#22c55e', Cancelled: '#ef4444', Failed: '#dc2626' };
        return (
            <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                {statuses.map(status => {
                    const points = days.map((day, i) => {
                        const entry = data.find(d => d._id.day === day && d._id.status === status);
                        const y = 100 - ((entry?.count || 0) / (Math.max(...data.map(d => d.count), 1) || 1)) * 80;
                        const x = (i / (days.length - 1 || 1)) * 100;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    }).join(' ');
                    return <path key={status} d={points} stroke={colors[status] || '#6b7280'} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
                })}
            </svg>
        );
    };

    if (loading) {
        return <div className="py-16 flex justify-center"><Loader2 size={26} className="animate-spin text-teal-600" /></div>;
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
                    <p className="text-sm text-gray-500">Real-time business metrics from live database aggregations.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <select value={range} onChange={e => setRange(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                        <option value={180}>Last 180 days</option>
                        <option value={365}>Last 365 days</option>
                    </select>
                    <button onClick={load} disabled={loading} className="px-4 py-2 border border-gray-300 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50"><RefreshCw size={14} /> Refresh</button>
                </div>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-4">
                {METRICS.map(m => (
                    <MetricCard key={m.key} metric={m} value={stats[m.key] ?? 0} />
                ))}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ChartCard title="Revenue Trend">{renderRevenueChart()}</ChartCard>
                <ChartCard title="Orders by Status">{renderStatusChart()}</ChartCard>
                <ChartCard title="Top Products">
                    {charts.bestSellers?.length ? (
                        <ul className="space-y-2">
                            {charts.bestSellers.slice(0, 8).map((p, i) => (
                                <li key={p._id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                    <span className="flex items-center gap-2"><span className="text-sm font-bold text-gray-400 w-6">{i + 1}</span><span className="font-medium truncate">{p.title}</span></span>
                                    <span className="text-sm text-gray-500">{p.units} units • {formatPrice(p.revenue)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-400 text-center py-8">No data</p>
                    )}
                </ChartCard>
                <ChartCard title="Category Performance">
                    {charts.categoryPerformance?.length ? (
                        <ul className="space-y-2">
                            {charts.categoryPerformance.slice(0, 8).map((c, i) => (
                                <li key={c._id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                    <span className="flex items-center gap-2"><span className="text-sm font-bold text-gray-400 w-6">{i + 1}</span><span className="font-medium capitalize">{c._id || 'Uncategorized'}</span></span>
                                    <span className="text-sm text-gray-500">{c.units} units • {formatPrice(c.revenue)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-400 text-center py-8">No data</p>
                    )}
                </ChartCard>
                <ChartCard title="Top Customers">
                    {charts.topCustomers?.length ? (
                        <ul className="space-y-2">
                            {charts.topCustomers.slice(0, 8).map((c, i) => (
                                <li key={c._id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                    <span className="flex items-center gap-2"><span className="text-sm font-bold text-gray-400 w-6">{i + 1}</span><span className="font-medium">{c.name || 'Unknown'}</span></span>
                                    <span className="text-sm text-gray-500">{c.orderCount} orders • {formatPrice(c.revenue)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-400 text-center py-8">No data</p>
                    )}
                </ChartCard>
                <ChartCard title="Deliveries Completed">
                    {charts.deliverySeries?.length ? (
                        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="delGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <path
                                d={charts.deliverySeries.map((d, i) => {
                                    const x = (i / (charts.deliverySeries.length - 1 || 1)) * 100;
                                    const maxD = Math.max(...charts.deliverySeries.map(x => x.count), 1);
                                    const y = 100 - (d.count / maxD) * 80;
                                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                }).join(' ')}
                                stroke="#f97316" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"
                            />
                            <path
                                d={charts.deliverySeries.map((d, i) => {
                                    const x = (i / (charts.deliverySeries.length - 1 || 1)) * 100;
                                    const maxD = Math.max(...charts.deliverySeries.map(x => x.count), 1);
                                    const y = 100 - (d.count / maxD) * 80;
                                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                                }).join(' ')}
                                stroke="none" fill="url(#delGrad)"
                            />
                        </svg>
                    ) : (
                        <p className="text-gray-400 text-center py-8">No delivery data</p>
                    )}
                </ChartCard>
            </div>
        </div>
    );
}