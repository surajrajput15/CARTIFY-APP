import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  RefreshCw,
  RotateCcw,
  Search,
  Eye,
  X,
  ShieldAlert
} from 'lucide-react';
import { fetchAdminOrders, updateOrderStatus, refundOrder } from '../../services/ordersApi';
import { ORDER_STATUSES } from '../../utils/constants';
import { formatPrice, formatDate } from '../../utils/format';
import { EmptyOrdersIllustration } from '../illustrations/EmptyStateIllustrations';
import ConfirmModal from '../ConfirmModal';
import OrderDetailModal from './OrderDetailModal';
import Card from '../ui/Card';
import { isNetworkError } from '../../utils/apiError';
import { nextStatuses } from '../../utils/orderTransitions';

const paymentBadge = (status) => {
  switch (status) {
    case 'Paid': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'Refunded': return 'bg-amber-50 text-amber-700 border border-amber-200';
    default: return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
};

const PAYMENT_FILTERS = [
  { id: 'all', label: 'All Payments' },
  { id: 'Paid', label: 'Paid Only' },
  { id: 'Pending', label: 'Pending Only' },
  { id: 'Refunded', label: 'Refunded Only' }
];

const getUrlParam = (key) => {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
};

const AdminOrdersTab = () => {
  const initialStatus = getUrlParam('orderStatus') || 'all';
  const initialPayment = getUrlParam('paymentStatus') || 'all';
  const initialShortfall = getUrlParam('stockShortfall') === 'true';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [paymentFilter, setPaymentFilter] = useState(initialPayment);
  const [stockShortfallFilter, setStockShortfallFilter] = useState(initialShortfall);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [busyId, setBusyId] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [inspectOrder, setInspectOrder] = useState(null);

  const syncUrl = (key, val) => {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    const params = new URLSearchParams(window.location.search);
    if (val && val !== 'all' && val !== false) {
      params.set(key, val);
    } else {
      params.delete(key);
    }
    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  };

  const loadOrders = useCallback(async (opts = {}) => {
    setLoading(true);
    try {
      const queryOpts = {
        status: opts.status ?? statusFilter,
        paymentStatus: opts.paymentStatus ?? (paymentFilter !== 'all' ? paymentFilter : undefined),
        stockShortfall: opts.stockShortfall ?? (stockShortfallFilter ? 'true' : undefined),
        search: opts.search ?? (activeSearch || undefined),
        page: opts.page ?? page,
        limit: 20
      };

      const { data } = await fetchAdminOrders(queryOpts);
      setOrders(data.orders || []);
      setPages(data.pages || 1);
      setTotalCount(data.total || 0);

      if (inspectOrder) {
        const refreshed = (data.orders || []).find((o) => o._id === inspectOrder._id);
        if (refreshed) setInspectOrder(refreshed);
      }
    } catch (err) {
      if (isNetworkError(err)) {
        toast.error('Backend unreachable. Check if server is running.');
      } else {
        toast.error('Failed to fetch orders');
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, paymentFilter, stockShortfallFilter, activeSearch, page, inspectOrder]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filter synchronization
    loadOrders();
  }, [loadOrders]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setActiveSearch(searchInput.trim());
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearch('');
    setPage(1);
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setPaymentFilter('all');
    setStockShortfallFilter(false);
    setSearchInput('');
    setActiveSearch('');
    setPage(1);
    syncUrl('orderStatus', null);
    syncUrl('paymentStatus', null);
    syncUrl('stockShortfall', null);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setBusyId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      toast.success(`Order transitioned to ${newStatus}`);
      await loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setBusyId(null);
    }
  };

  const handleRefund = async (order) => {
    setBusyId(order._id);
    try {
      await refundOrder(order._id);
      toast.success('Refund initiated');
      await loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refund failed');
    } finally {
      setBusyId(null);
      setRefundTarget(null);
    }
  };

  const hasActiveFilters = statusFilter !== 'all' || paymentFilter !== 'all' || stockShortfallFilter || activeSearch !== '';

  return (
    <>
      <div className="space-y-4">
        {/* Top Control Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-lg">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Order ID, Customer, Email, Phone, Razorpay ID..."
              className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-gray-50/50"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </form>

          {/* Quick Filter Badges / Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Payment Filter Selector */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs font-semibold text-gray-600">
              {PAYMENT_FILTERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPaymentFilter(p.id);
                    setPage(1);
                    syncUrl('paymentStatus', p.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg capitalize transition-colors ${
                    paymentFilter === p.id ? 'bg-white text-gray-900 shadow-xs font-bold' : 'hover:text-gray-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Shortfall Filter Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !stockShortfallFilter;
                setStockShortfallFilter(next);
                setPage(1);
                syncUrl('stockShortfall', next ? 'true' : null);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                stockShortfallFilter
                  ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <ShieldAlert size={14} className={stockShortfallFilter ? 'text-rose-600' : 'text-gray-400'} />
              Stock Shortfalls
            </button>

            {/* Refresh */}
            <button
              onClick={() => loadOrders()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors border border-teal-200/60"
              title="Refresh order database"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-gray-500 hover:text-gray-800 underline px-1"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Status Pills Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Filter orders by status">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mr-1 flex-shrink-0">
            Lifecycle:
          </span>
          {['all', ...ORDER_STATUSES].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
                syncUrl('orderStatus', s);
              }}
              aria-pressed={statusFilter === s}
              className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-colors flex-shrink-0 ${
                statusFilter === s ? 'bg-teal-600 text-white shadow-xs' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Orders Table Manifest */}
        <Card className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm bg-white">
          <div className="overflow-x-auto" role="region" aria-label="Orders table (scroll horizontally)" tabIndex={0}>
            <table className="w-full text-sm min-w-[960px]">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left p-4 font-bold text-gray-600">Order</th>
                  <th className="text-left p-4 font-bold text-gray-600">Customer</th>
                  <th className="text-left p-4 font-bold text-gray-600">Items</th>
                  <th className="text-left p-4 font-bold text-gray-600">Total</th>
                  <th className="text-left p-4 font-bold text-gray-600">Payment</th>
                  <th className="text-left p-4 font-bold text-gray-600">Status</th>
                  <th className="text-left p-4 font-bold text-gray-600">Date</th>
                  <th className="text-center p-4 font-bold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">Loading orders…</td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8">
                      <div className="flex flex-col items-center justify-center gap-3 text-center">
                        <EmptyOrdersIllustration className="w-24 h-24" />
                        <p className="text-gray-500 text-sm">
                          No orders found{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="mt-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 transition-colors"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => {
                    const items = o.orderItems || [];
                    const totalUnits = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
                    const productTypes = items.length;
                    const shortId = String(o._id).slice(-6).toUpperCase();

                    return (
                      <tr
                        key={o._id}
                        className="hover:bg-gray-50/70 transition-colors group cursor-pointer"
                        onClick={(e) => {
                          if (e.target.closest('button') || e.target.closest('select')) return;
                          setInspectOrder(o);
                        }}
                      >
                        {/* Order ID */}
                        <td className="p-4 font-mono text-xs text-gray-500">
                          #{shortId}
                        </td>

                        {/* Customer */}
                        <td className="p-4">
                          <p className="font-medium text-gray-800">{o.userId?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{o.userId?.email || '—'}</p>
                        </td>

                        {/* Items */}
                        <td className="p-4 text-gray-600">
                          <span className="font-medium">{totalUnits}</span> {totalUnits === 1 ? 'unit' : 'units'}
                          <span className="text-gray-500 text-xs ml-1">({productTypes} {productTypes === 1 ? 'product' : 'products'})</span>
                        </td>

                        {/* Total */}
                        <td className="p-4 font-bold text-gray-900">{formatPrice(o.totalPrice ?? 0)}</td>

                        {/* Payment */}
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${paymentBadge(o.paymentStatus)}`}>
                            {o.paymentStatus}
                          </span>
                        </td>

                        {/* Status Select */}
                        <td className="p-4">
                          <select
                            value={o.status}
                            disabled={busyId === o._id || nextStatuses(o.status).length === 1}
                            onChange={(e) => handleStatusChange(o._id, e.target.value)}
                            aria-label={`Change status for order ${shortId}`}
                            className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 min-h-[44px]"
                          >
                            {nextStatuses(o.status).map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>

                        {/* Date */}
                        <td className="p-4 text-gray-500 text-xs whitespace-nowrap">{formatDate(o.createdAt)}</td>

                        {/* Actions */}
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setInspectOrder(o)}
                              className="p-2 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                              title="Inspect full order manifest & timeline"
                              aria-label={`Inspect order ${shortId}`}
                            >
                              <Eye size={16} />
                            </button>

                            {o.paymentStatus === 'Paid' && (
                              <button
                                type="button"
                                onClick={() => setRefundTarget(o)}
                                disabled={busyId === o._id}
                                className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 p-2 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px]"
                                aria-label={`Refund order ${shortId}`}
                                title="Refund this order"
                              >
                                <RotateCcw size={16} aria-hidden="true" />
                              </button>
                            )}
                            {o.paymentStatus === 'Refunded' && (
                              <span className="text-xs font-bold text-amber-600">Refunded</span>
                            )}
                            {o.paymentStatus === 'Pending' && (
                              <span className="text-xs text-gray-500">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Operational Pagination Footer */}
          {pages > 1 && (
            <nav className="p-4 bg-gray-50/60 border-t border-gray-100 flex justify-center items-center gap-2" aria-label="Orders pagination">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 min-h-[44px]"
              >
                Prev
              </button>
              <span className="text-sm font-bold text-gray-700">Page {page} / {pages} ({totalCount} total)</span>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages || loading}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 min-h-[44px]"
              >
                Next
              </button>
            </nav>
          )}
        </Card>
      </div>

      {/* Inspect Order Modal */}
      {inspectOrder && (
        <OrderDetailModal
          order={inspectOrder}
          isOpen={Boolean(inspectOrder)}
          onClose={() => setInspectOrder(null)}
          onStatusChange={handleStatusChange}
          onRefund={handleRefund}
          isUpdating={busyId === inspectOrder._id}
        />
      )}

      {/* Refund Confirmation Modal */}
      {refundTarget && (
        <ConfirmModal
          title="Confirm Refund"
          message={`Refund ${formatPrice(refundTarget.totalPrice || 0)} for order #${String(refundTarget._id).slice(-6).toUpperCase()}? This cannot be undone.`}
          confirmLabel="Refund"
          loading={busyId === refundTarget._id}
          onConfirm={() => handleRefund(refundTarget)}
          onCancel={() => setRefundTarget(null)}
        />
      )}
    </>
  );
};

export default AdminOrdersTab;