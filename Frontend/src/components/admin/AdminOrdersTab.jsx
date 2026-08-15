import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { fetchAdminOrders, updateOrderStatus, refundOrder } from '../../services/ordersApi';

const ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

const paymentBadge = (status) => {
  switch (status) {
    case 'Paid': return 'bg-green-50 text-green-700';
    case 'Refunded': return 'bg-amber-50 text-amber-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const AdminOrdersTab = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [busyId, setBusyId] = useState(null);

  // Fetch without touching loading synchronously inside the effect (linter rule);
  // the click handlers set loading=true before refetching.
  useEffect(() => {
    let cancelled = false;
    fetchAdminOrders(statusFilter, page)
      .then(({ data }) => {
        if (cancelled) return;
        setOrders(data.orders);
        setPages(data.pages);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to fetch orders');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [statusFilter, page]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAdminOrders(statusFilter, page);
      setOrders(data.orders);
      setPages(data.pages);
    } catch {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  const handleStatusChange = async (orderId, newStatus) => {
    setBusyId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      toast.success('Order status updated');
      await reload();
    } catch {
      toast.error('Failed to update order status');
    } finally {
      setBusyId(null);
    }
  };

  const handleRefund = async (order) => {
    if (!window.confirm(`Refund ₹${Number(order.totalPrice || 0).toFixed(2)} for order ${order._id.slice(-6)}?`)) return;
    setBusyId(order._id);
    try {
      await refundOrder(order._id);
      toast.success('Refund initiated');
      await reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Refund failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {['all', ...ORDER_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => { setLoading(true); setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-colors ${
                statusFilter === s ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={reload}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-600 hover:text-teal-800"
        >
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left p-4 font-bold text-gray-600">Order</th>
                <th className="text-left p-4 font-bold text-gray-600">Customer</th>
                <th className="text-left p-4 font-bold text-gray-600">Items</th>
                <th className="text-left p-4 font-bold text-gray-600">Total</th>
                <th className="text-left p-4 font-bold text-gray-600">Payment</th>
                <th className="text-left p-4 font-bold text-gray-600">Status</th>
                <th className="text-left p-4 font-bold text-gray-600">Date</th>
                <th className="text-center p-4 font-bold text-gray-600">Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">Loading orders…</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">No orders found.</td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o._id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-mono text-xs text-gray-500">#{o._id.slice(-6)}</td>
                    <td className="p-4">
                      <p className="font-medium text-gray-800">{o.userId?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{o.userId?.email}</p>
                    </td>
                    <td className="p-4 text-gray-600">
                      {o.orderItems.reduce((sum, it) => sum + (it.quantity || 1), 0)} ({o.orderItems.length} types)
                    </td>
                    <td className="p-4 font-bold text-gray-900">₹{(o.totalPrice ?? 0).toFixed(2)}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${paymentBadge(o.paymentStatus)}`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <select
                        value={o.status}
                        disabled={busyId === o._id}
                        onChange={(e) => handleStatusChange(o._id, e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50"
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 text-gray-500 text-xs">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 text-center">
                      {o.paymentStatus === 'Paid' && (
                        <button
                          onClick={() => handleRefund(o)}
                          disabled={busyId === o._id}
                          className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 p-2 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                          aria-label={`Refund order ${o._id}`}
                          title="Refund this order"
                        >
                          <RotateCcw size={16} aria-hidden="true" />
                        </button>
                      )}
                      {o.paymentStatus === 'Refunded' && (
                        <span className="text-xs font-bold text-amber-600">Refunded</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => { setLoading(true); setPage((p) => Math.max(1, p - 1)); }}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm font-bold text-gray-700">Page {page} / {pages}</span>
          <button
            onClick={() => { setLoading(true); setPage((p) => Math.min(pages, p + 1)); }}
            disabled={page === pages}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminOrdersTab;