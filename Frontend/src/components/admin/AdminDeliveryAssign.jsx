import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ClipboardList, UserCheck, Users, RefreshCw, Loader2 } from 'lucide-react';
import { fetchAdminDeliveryOrders, fetchDeliveryPartners, assignDeliveryPartner } from '../../services/deliveryApi';
import { formatPrice, formatDate } from '../../utils/format';
import { isNetworkError } from '../../utils/apiError';

const AdminDeliveryAssign = () => {
  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, partnersRes] = await Promise.all([
        fetchAdminDeliveryOrders({ deliveryStatus: 'not_assigned', limit: 50 }),
        fetchDeliveryPartners(),
      ]);
      setOrders(ordersRes.data.orders || []);
      setPartners(partnersRes.data.partners || []);
    } catch (err) {
      toast.error(isNetworkError(err) ? 'Backend is unreachable. Please start the server and click Retry.' : 'Failed to load assignment data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAssign = async (order) => {
    const partnerId = selected[order._id];
    if (!partnerId) {
      toast.error('Select a delivery partner first');
      return;
    }
    setBusyId(order._id);
    try {
      await assignDeliveryPartner(order._id, partnerId);
      toast.success('Delivery partner assigned');
      setOrders((prev) => prev.filter((o) => o._id !== order._id));
      setSelected((prev) => { const { [order._id]: _, ...rest } = prev; return rest; });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to assign delivery partner');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 text-teal-600">
            <UserCheck size={20} aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-bold text-gray-800">Assign delivery partners</h3>
            <p className="text-sm text-gray-500">
              {loading ? 'Loading…' : `${orders.length} order${orders.length === 1 ? '' : 's'} awaiting assignment`}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-teal-600" size={24} aria-hidden="true" /></div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <ClipboardList size={32} className="text-gray-300" aria-hidden="true" />
          <p className="text-gray-500 text-sm">No orders waiting for a delivery partner.</p>
        </div>
      ) : partners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Users size={32} className="text-gray-300" aria-hidden="true" />
          <p className="text-gray-500 text-sm">No delivery partners registered yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto" role="region" aria-label="Orders awaiting delivery assignment (scroll horizontally)" tabIndex={0}>
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left p-4 font-bold text-gray-600">Order</th>
                <th className="text-left p-4 font-bold text-gray-600">Customer</th>
                <th className="text-left p-4 font-bold text-gray-600">Total</th>
                <th className="text-left p-4 font-bold text-gray-600">Date</th>
                <th className="text-left p-4 font-bold text-gray-600">Assign to</th>
                <th className="text-right p-4 font-bold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((o) => (
                <tr key={o._id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono text-xs text-gray-500">#{o.orderId || String(o._id).slice(-8).toUpperCase()}</td>
                  <td className="p-4">
                    <p className="font-medium text-gray-800">{o.userId?.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{o.userId?.email || '—'}</p>
                  </td>
                  <td className="p-4 font-bold text-gray-900">{formatPrice(o.totalPrice ?? 0)}</td>
                  <td className="p-4 text-gray-500 text-xs whitespace-nowrap">{formatDate(o.createdAt)}</td>
                  <td className="p-4">
                    <select
                      value={selected[o._id] || ''}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [o._id]: e.target.value }))}
                      aria-label={`Delivery partner for order ${o.orderId || String(o._id).slice(-8).toUpperCase()}`}
                      className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:ring-teal-500 focus:border-teal-500 min-h-[40px]"
                    >
                      <option value="">Select partner…</option>
                      {partners.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}{p.activeDeliveries > 0 ? ` (${p.activeDeliveries} live)` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleAssign(o)}
                      disabled={busyId === o._id || !selected[o._id]}
                      className="inline-flex items-center gap-1 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors min-h-[40px]"
                    >
                      {busyId === o._id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <UserCheck size={14} aria-hidden="true" />}
                      Assign
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDeliveryAssign;