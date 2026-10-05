import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  RefreshCw,
  AlertTriangle,
  Users,
  Package,
  Truck,
  Warehouse,
  ChevronRight,
  Loader2,
  ClipboardList,
  CircleDollarSign,
  Clock,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Activity,
  ArrowRight,
  Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { loadControlSnapshot } from '../../services/controlApi';
import { formatPrice } from '../../utils/format';
import { isNetworkError } from '../../utils/apiError';
import OrderDetailModal from './OrderDetailModal';
import { updateOrderStatus, refundOrder } from '../../services/ordersApi';

const CARD = 'bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden';

const AdminControlTab = ({ onNavigate }) => {
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [lastUpdated, setLastUpdated] = useState(null);

  // Modal inspection for recent orders
  const [inspectOrder, setInspectOrder] = useState(null);
  const [busyOrderId, setBusyOrderId] = useState(null);

  // Live clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await loadControlSnapshot();
      setSnap(res);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      if (!isNetworkError(err)) toast.error('Failed to load command center metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial mount fetch
    load();
  }, [load]);

  const handleStatusChange = async (orderId, newStatus) => {
    setBusyOrderId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      toast.success(`Order transitioned to ${newStatus}`);
      await load(false);
      if (inspectOrder && inspectOrder._id === orderId) {
        setInspectOrder((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleRefund = async (order) => {
    setBusyOrderId(order._id);
    try {
      await refundOrder(order._id);
      toast.success('Refund initiated successfully');
      await load(false);
      setInspectOrder(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refund failed');
    } finally {
      setBusyOrderId(null);
    }
  };

  const stats = snap?.stats || {};
  const partners = (snap?.partners || []).slice(0, 4);
  const warehouses = (snap?.warehouses || []).slice(0, 4);
  const recentOrders = Array.isArray(stats.recentOrders) ? stats.recentOrders : [];
  const orderBreakdown = stats.orderBreakdown || {};
  const actionRequired = Array.isArray(stats.actionRequired) ? stats.actionRequired : [];

  const getStatusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'delivered') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'shipped' || s === 'out for delivery') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (s === 'processing' || s === 'packed' || s === 'confirmed') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    if (s === 'cancelled' || s === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getPaymentBadge = (status) => {
    switch (status) {
      case 'Paid': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'Refunded': return 'bg-amber-50 text-amber-700 border border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  if (loading && !snap) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3" role="status" aria-label="Loading command center">
        <Loader2 size={36} className="animate-spin text-teal-600" aria-hidden="true" />
        <p className="text-sm font-semibold text-gray-700">Connecting to operations engine & aggregating metrics…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SECTION A: OPERATIONAL HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-sm">
            <LayoutDashboard size={22} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                Operations Command Center
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Console
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Enterprise real-time inventory, sales settlement, and courier fulfillment telemetry
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-left sm:text-right">
            <div className="text-xs font-mono font-bold text-gray-800">
              {currentTime}
            </div>
            <div className="text-[11px] text-gray-400">
              {lastUpdated ? `Synced: ${lastUpdated}` : 'Live'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3.5 py-2 rounded-xl transition-colors min-h-[40px] border border-teal-200/60"
            title="Refresh database telemetry"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* SECTION B: PRIMARY OPERATIONS KPI GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
        {/* Today's Sales */}
        <button
          type="button"
          onClick={() => onNavigate?.('analytics')}
          className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 flex flex-col justify-between text-left hover:shadow-md transition-all min-h-[105px] group overflow-hidden"
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Today's Sales</span>
            <CircleDollarSign size={15} className="text-teal-600 group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div>
            <div className="text-base sm:text-xl font-black text-teal-600 truncate">
              {formatPrice(stats.todayRevenue || 0)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate mt-0.5 flex items-center gap-1">
              {stats.revenueTrend !== null && stats.revenueTrend !== undefined ? (
                <span className={`inline-flex items-center font-bold ${stats.revenueTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {stats.revenueTrend >= 0 ? <TrendingUp size={11} className="mr-0.5 shrink-0" /> : <TrendingDown size={11} className="mr-0.5 shrink-0" />}
                  {stats.revenueTrend >= 0 ? `+${stats.revenueTrend}%` : `${stats.revenueTrend}%`}
                </span>
              ) : (
                <span>Total: {formatPrice(stats.revenue || 0)}</span>
              )}
            </div>
          </div>
        </button>

        {/* Today's Orders */}
        <button
          type="button"
          onClick={() => onNavigate?.('orders')}
          className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 flex flex-col justify-between text-left hover:shadow-md transition-all min-h-[105px] group overflow-hidden"
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Today's Orders</span>
            <ClipboardList size={15} className="text-blue-600 group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div>
            <div className="text-base sm:text-xl font-black text-blue-600">
              {stats.todayOrders ?? 0}
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate mt-0.5">
              {stats.ordersTrend !== null && stats.ordersTrend !== undefined ? (
                <span className={`inline-flex items-center font-bold ${stats.ordersTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {stats.ordersTrend >= 0 ? <TrendingUp size={11} className="mr-0.5 shrink-0" /> : <TrendingDown size={11} className="mr-0.5 shrink-0" />}
                  {stats.ordersTrend >= 0 ? `+${stats.ordersTrend}%` : `${stats.ordersTrend}%`} vs yday
                </span>
              ) : (
                <span>Total: {stats.totalOrders ?? 0}</span>
              )}
            </div>
          </div>
        </button>

        {/* Average Order Value (AOV) */}
        <button
          type="button"
          onClick={() => onNavigate?.('analytics')}
          className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 flex flex-col justify-between text-left hover:shadow-md transition-all min-h-[105px] group overflow-hidden"
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Avg Order Value</span>
            <Activity size={15} className="text-emerald-600 group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div>
            <div className="text-base sm:text-xl font-black text-emerald-600 truncate">
              {formatPrice(stats.aov || 0)}
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate mt-0.5">
              Today: {formatPrice(stats.todayAov || 0)}
            </div>
          </div>
        </button>

        {/* Customers */}
        <button
          type="button"
          onClick={() => onNavigate?.('users')}
          className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 flex flex-col justify-between text-left hover:shadow-md transition-all min-h-[105px] group overflow-hidden"
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Customers</span>
            <Users size={15} className="text-purple-600 group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div>
            <div className="text-base sm:text-xl font-black text-purple-600">
              {stats.totalUsers ?? 0}
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate mt-0.5">
              +{stats.newUsersToday ?? 0} today • +{stats.newUsers30d ?? 0} 30d
            </div>
          </div>
        </button>

        {/* Catalog SKUs */}
        <button
          type="button"
          onClick={() => onNavigate?.('products')}
          className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 flex flex-col justify-between text-left hover:shadow-md transition-all min-h-[105px] group overflow-hidden"
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Catalog SKUs</span>
            <Package size={15} className="text-indigo-600 group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div>
            <div className="text-base sm:text-xl font-black text-indigo-600">
              {stats.totalProducts ?? 0}
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate mt-0.5">
              {stats.lowStockCount ?? 0} low • {stats.outOfStockCount ?? 0} empty
            </div>
          </div>
        </button>

        {/* Active Couriers */}
        <button
          type="button"
          onClick={() => onNavigate?.('deliveries')}
          className="bg-white rounded-2xl border border-gray-100 p-3 sm:p-4 flex flex-col justify-between text-left hover:shadow-md transition-all min-h-[105px] group overflow-hidden"
        >
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider truncate">Deliveries</span>
            <Truck size={15} className="text-rose-600 group-hover:scale-110 transition-transform shrink-0" />
          </div>
          <div>
            <div className="text-base sm:text-xl font-black text-rose-600">
              {stats.activeDeliveries ?? 0}
            </div>
            <div className="text-[10px] sm:text-[11px] text-gray-500 font-medium truncate mt-0.5">
              {stats.pendingDeliveryAssignment ?? 0} unassigned
            </div>
          </div>
        </button>
      </div>

      {/* SECTION C: ACTION REQUIRED OPERATIONAL CONSOLE */}
      <section className={CARD}>
        <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <h3 className="text-sm font-bold text-gray-900">
              Action Required Queue
            </h3>
            {actionRequired.length > 0 && (
              <span className="bg-rose-100 text-rose-700 text-xs font-extrabold px-2 py-0.5 rounded-full ml-1">
                {actionRequired.length} {actionRequired.length === 1 ? 'Notice' : 'Notices'}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500 font-medium">
            Prioritized operational interventions
          </span>
        </header>

        <div className="p-5">
          {actionRequired.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={22} />
              </div>
              <p className="text-sm font-bold text-gray-800">All Operations Clear</p>
              <p className="text-xs text-gray-500 max-w-sm">
                No inventory shortfalls, courier bottlenecks, or pending refund requests currently require administrator intervention.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {actionRequired.map((item) => {
                const isCritical = item.severity === 'critical';
                const isWarning = item.severity === 'warning';
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-shadow ${
                      isCritical
                        ? 'bg-rose-50/70 border-rose-200'
                        : isWarning
                        ? 'bg-amber-50/70 border-amber-200'
                        : 'bg-blue-50/70 border-blue-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          isCritical
                            ? 'bg-rose-200 text-rose-800'
                            : isWarning
                            ? 'bg-amber-200 text-amber-800'
                            : 'bg-blue-200 text-blue-800'
                        }`}>
                          {item.severity}
                        </span>
                        <span className="font-mono text-xs font-black text-gray-900">
                          Count: {item.count}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-gray-900">{item.title}</h4>
                      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const extraParams = {};
                        if (item.actionFilter === 'stockShortfall') extraParams.stockShortfall = 'true';
                        if (item.actionFilter === 'refunds') extraParams.paymentStatus = 'Paid';
                        onNavigate?.(item.actionTab, extraParams);
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors min-h-[36px] ${
                        isCritical
                          ? 'bg-rose-600 text-white hover:bg-rose-700'
                          : isWarning
                          ? 'bg-amber-600 text-white hover:bg-amber-700'
                          : 'bg-teal-600 text-white hover:bg-teal-700'
                      }`}
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* SECTION D: INTERACTIVE ORDER FULFILLMENT PIPELINE */}
      <section className={CARD}>
        <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-teal-600" />
            <h3 className="text-sm font-bold text-gray-900">Order Fulfillment Lifecycle</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate?.('orders', { orderStatus: 'all' })}
            className="text-xs font-bold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
          >
            All Orders Table <ArrowUpRight size={14} />
          </button>
        </header>

        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              { label: 'Pending', key: 'Pending', count: orderBreakdown.pending ?? 0, bg: 'bg-gray-50 border-gray-200 text-gray-700' },
              { label: 'Confirmed', key: 'Confirmed', count: orderBreakdown.confirmed ?? 0, bg: 'bg-cyan-50 border-cyan-200 text-cyan-800' },
              { label: 'Processing', key: 'Processing', count: (orderBreakdown.processing ?? 0) + (orderBreakdown.packed ?? 0), bg: 'bg-amber-50 border-amber-200 text-amber-800' },
              { label: 'In Transit', key: 'Shipped', count: (orderBreakdown.shipped ?? 0) + (orderBreakdown.outForDelivery ?? 0), bg: 'bg-blue-50 border-blue-200 text-blue-800' },
              { label: 'Delivered', key: 'Delivered', count: orderBreakdown.delivered ?? 0, bg: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
              { label: 'Cancelled / Refunded', key: 'Cancelled', count: (orderBreakdown.cancelled ?? 0) + (orderBreakdown.refunded ?? 0), bg: 'bg-rose-50 border-rose-200 text-rose-800' }
            ].map((step) => (
              <button
                key={step.key}
                type="button"
                onClick={() => onNavigate?.('orders', { orderStatus: step.key })}
                className={`p-3 rounded-xl border text-center transition-all hover:scale-[1.02] hover:shadow-sm cursor-pointer ${step.bg}`}
                title={`Filter orders by ${step.label}`}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider">{step.label}</p>
                <p className="text-xl font-black mt-1">{step.count}</p>
                <span className="text-[10px] font-semibold text-gray-500 mt-0.5 inline-flex items-center gap-0.5">
                  Filter orders <ChevronRight size={10} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION E: RECENT CUSTOMER ORDERS & INFRASTRUCTURE HUBS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders Table */}
        <div className={`lg:col-span-2 ${CARD}`}>
          <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-teal-600" />
              <h3 className="text-sm font-bold text-gray-900">Recent Customer Orders</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('orders')}
              className="text-xs font-bold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
            >
              View Full Table <ChevronRight size={13} />
            </button>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      No customer orders have been placed yet.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((o) => {
                    const shortId = String(o._id).slice(-6).toUpperCase();
                    return (
                      <tr
                        key={o._id}
                        className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                        onClick={() => setInspectOrder(o)}
                      >
                        <td className="p-3 font-mono font-bold text-gray-700">
                          #{shortId}
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-gray-900 truncate max-w-[140px]">{o.userId?.name || 'Customer'}</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{o.userId?.email || '—'}</p>
                        </td>
                        <td className="p-3 font-bold text-gray-900">
                          {formatPrice(o.totalPrice ?? 0)}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getPaymentBadge(o.paymentStatus)}`}>
                            {o.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(o.status)}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectOrder(o);
                            }}
                            className="p-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors inline-flex items-center"
                            title="Open order operations modal"
                            aria-label={`Inspect order #${shortId}`}
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operational Hubs (Warehouses & Couriers) */}
        <div className="space-y-6">
          {/* Warehouses Snapshot */}
          <div className={CARD}>
            <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Warehouse size={18} className="text-teal-600" />
                <h3 className="text-sm font-bold text-gray-900">Fulfillment Hubs</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('warehouses')}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
              >
                Manage <ChevronRight size={13} />
              </button>
            </header>

            <div className="p-4 divide-y divide-gray-100">
              {warehouses.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">No fulfillment hubs configured.</p>
              ) : (
                warehouses.map((w) => (
                  <div key={w._id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-800">{w.name}</p>
                      <p className="text-[11px] text-gray-400">{w.city || w.code || 'Primary'} • {w.state || 'Active'}</p>
                    </div>
                    <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                      {w.code || 'HUB'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Delivery Partners Snapshot */}
          <div className={CARD}>
            <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-teal-600" />
                <h3 className="text-sm font-bold text-gray-900">Courier Fleet</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('deliveries')}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
              >
                Fleet Portal <ChevronRight size={13} />
              </button>
            </header>

            <div className="p-4 divide-y divide-gray-100">
              {partners.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">No active delivery partners registered.</p>
              ) : (
                partners.map((p) => (
                  <div key={p._id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-800">{p.name}</p>
                      <p className="text-[11px] text-gray-400">{p.phone || p.email}</p>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Active
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Inspect Order Modal */}
      {inspectOrder && (
        <OrderDetailModal
          order={inspectOrder}
          isOpen={Boolean(inspectOrder)}
          onClose={() => setInspectOrder(null)}
          onStatusChange={handleStatusChange}
          onRefund={handleRefund}
          isUpdating={busyOrderId === inspectOrder._id}
        />
      )}
    </div>
  );
};

export default AdminControlTab;
