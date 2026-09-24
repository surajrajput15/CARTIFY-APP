import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Loader2, X, Warehouse as WarehouseIcon, Package, ArrowDownUp, TrendingUp, ArrowLeftRight, History } from 'lucide-react';
import { fetchWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, fetchInventory, setStock, clearProductRows, recomputeAllStock, fetchStockLedger, fetchStockWarehouses, transferStock, fetchInventoryAlerts } from '../../services/warehousesApi';
import { isNetworkError } from '../../utils/apiError';
import ConfirmModal from '../ConfirmModal';
import { formatPrice } from '../../utils/format';

const EMPTY_FORM = { name: '', code: '', city: '', state: '', addressLine: '', managerName: '', isActive: true };

function AdminWarehousesTab() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmModal, setConfirmModal] = useState(null);

  // Master-detail: selected warehouse + its inventory rows
  const [active, setActive] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invSearch, setInvSearch] = useState('');
  const [editingStock, setEditingStock] = useState(null); // { rowId, quantity }
  const [stockSavingId, setStockSavingId] = useState(null);

  // Stock ledger history
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Transfer modal
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferWhs, setTransferWhs] = useState([]);
  const [transferForm, setTransferForm] = useState({ productId: '', from: '', to: '', quantity: '', variantKey: '', note: '' });
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferLines, setTransferLines] = useState([]); // products for the picker

  // Inventory alerts (#7) — rows at/below their lowStockThreshold
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWarehouses();
      setWarehouses(res.data.warehouses || []);
    } catch (err) {
      if (!isNetworkError(err)) toast.error('Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const res = await fetchInventoryAlerts();
      setAlerts(res.data.alerts || []);
    } catch {
      // Non-blocking — the tab still works without the alerts panel.
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const loadInventory = useCallback(async (whId, search) => {
    if (!whId) return;
    setInvLoading(true);
    try {
      const params = search ? { search } : undefined;
      const res = await fetchInventory(whId, params);
      setInventory(res.data.items || []);
    } catch {
      toast.error('Failed to load inventory');
    } finally {
      setInvLoading(false);
    }
  }, []);

  const openWarehouse = (w) => {
    setActive(w);
    setInvSearch('');
    loadInventory(w._id, '');
  };

  // debounced search
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => loadInventory(active._id, invSearch), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invSearch, active?._id]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (w) => {
    setEditingId(w._id);
    setForm({
      name: w.name, code: w.code, city: w.city, state: w.state,
      addressLine: w.addressLine || '', managerName: w.managerName || '', isActive: w.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.code?.trim() || !form.city?.trim() || !form.state?.trim()) {
      toast.error('name, code, city and state are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateWarehouse(editingId, form);
        toast.success('Warehouse updated');
      } else {
        await createWarehouse(form);
        toast.success('Warehouse created');
      }
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save warehouse');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (w) => {
    setConfirmModal({
      show: true,
      title: 'Delete Warehouse',
      message: `Delete "${w.name}"? This is refused if the warehouse still holds stock.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        try {
          await deleteWarehouse(w._id);
          toast.success('Warehouse deleted');
          if (active?._id === w._id) setActive(null);
          await load();
          setConfirmModal(null);
        } catch (err) {
          toast.error(err?.response?.data?.message || 'Failed to delete warehouse');
        }
      },
    });
  };

  const toggleActive = async (w) => {
    try {
      await updateWarehouse(w._id, { isActive: !w.isActive });
      setWarehouses((prev) => prev.map((x) => (x._id === w._id ? { ...x, isActive: !w.isActive } : x)));
    } catch {
      toast.error('Failed to update status');
    }
  };

  const saveStock = async (row) => {
    const qty = Number(editingStock);
    if (!Number.isInteger(qty) || qty < 0) {
      toast.error('Quantity must be a non-negative integer');
      return;
    }
    setStockSavingId(row._id);
    try {
      await setStock(active._id, row.productId, { variantKey: row.variantKey || undefined, quantity: qty });
      toast.success('Stock updated — sellable stock resynced');
      setEditingStock(null);
      await loadInventory(active._id, invSearch);
      await load();
      loadAlerts();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update stock');
    } finally {
      setStockSavingId(null);
    }
  };

  const handleRecompute = async () => {
    try {
      const res = await recomputeAllStock();
      toast.success(res.data?.message || 'All products resynced from warehouse rows');
      await load();
      loadAlerts();
    } catch {
      toast.error('Recompute failed');
    }
  };

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const res = await fetchStockLedger();
      setLedger(res.data.transactions || []);
    } catch {
      toast.error('Failed to load stock ledger');
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => { loadLedger(); }, [loadLedger]);

  const openTransfer = async () => {
    setShowTransfer(true);
    setTransferForm({ productId: '', from: '', to: '', quantity: '', variantKey: '', note: '' });
    setTransferLoading(true);
    try {
      const [whs, prods] = await Promise.all([
        fetchStockWarehouses(),
        import('../../services/productsApi').then((m) => m.fetchProducts({ limit: 100 })),
      ]);
      setTransferWhs(whs.data.warehouses || []);
      const products = prods.data.products || prods.data.productsList || [];
      setTransferLines(products);
    } catch {
      toast.error('Failed to load transfer options');
    } finally {
      setTransferLoading(false);
    }
  };

  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const submitTransfer = async (e) => {
    e.preventDefault();
    const qty = Number(transferForm.quantity);
    if (!transferForm.productId || !transferForm.from || !transferForm.to) {
      toast.error('Select product, source and destination');
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error('Quantity must be a positive integer');
      return;
    }
    if (transferForm.from === transferForm.to) {
      toast.error('Source and destination must differ');
      return;
    }
    setTransferSubmitting(true);
    try {
      const res = await transferStock({
        productId: transferForm.productId,
        variantKey: transferForm.variantKey || null,
        quantity: qty,
        fromWarehouseId: transferForm.from,
        toWarehouseId: transferForm.to,
        note: transferForm.note,
      });
      toast.success(res.data?.message || 'Stock transferred');
      setShowTransfer(false);
      await loadLedger();
      if (active) loadInventory(active._id, invSearch);
      await load();
      loadAlerts();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Transfer failed');
    } finally {
      setTransferSubmitting(false);
    }
  };

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const selectedTransferProduct = transferLines.find((p) => p._id === transferForm.productId);
  const transferVariantKeys = (selectedTransferProduct?.variants || []).map((v) => `${v.size || ''}|${v.color || ''}`);

  const totalUnits = warehouses.reduce((s, w) => s + (w.totalUnits || 0), 0);
  const totalSkus = warehouses.reduce((s, w) => s + (w.skuCount || 0), 0);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 text-teal-600">
            <WarehouseIcon size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-bold text-gray-800">Warehouses</h2>
            <p className="text-sm text-gray-500">{warehouses.length} active hubs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openTransfer}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-bold rounded-xl border border-indigo-100 transition-colors"
          >
            <ArrowLeftRight size={16} aria-hidden="true" /> Transfer
          </button>
          <button
            onClick={handleRecompute}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-semibold rounded-xl transition-colors"
            title="Resync every Product's stock from its warehouse rows"
          >
            <TrendingUp size={16} aria-hidden="true" /> Resync
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> Add warehouse
          </button>
        </div>
      </div>

      {(totalSkus > 0 || totalUnits > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 font-medium uppercase">Total SKU rows</p>
            <p className="text-xl font-bold">{totalSkus}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 font-medium uppercase">Total units tracked</p>
            <p className="text-xl font-bold">{totalUnits}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 font-medium uppercase">Sellable stock source</p>
            <p className="text-sm font-semibold">Sum across warehouses</p>
          </div>
        </div>
      )}

      {!alertsLoading && alerts.length > 0 && (
        <div className={`rounded-2xl border p-4 ${alerts.some((a) => a.critical) ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
          <button
            type="button"
            onClick={() => setShowAlerts((s) => !s)}
            className="w-full flex flex-wrap items-center justify-between gap-2 text-left"
            aria-expanded={showAlerts}
          >
            <span className="flex items-center gap-2">
              <span className={`text-sm font-extrabold px-2.5 py-1 rounded-full ${alerts.some((a) => a.critical) ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                {alerts.filter((a) => a.critical).length} critical · {alerts.length - alerts.filter((a) => a.critical).length} low
              </span>
              <span className="font-semibold text-gray-700 text-sm sm:text-base">Inventory alerts (at/below shelf low-stock threshold)</span>
            </span>
            <span className="text-xs font-bold text-gray-500">{showAlerts ? 'Hide' : 'Show'} details {showAlerts ? '▴' : '▾'}</span>
          </button>
          {showAlerts && (
            <div className="mt-3 max-h-72 overflow-y-auto rounded-xl bg-white border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-left">Warehouse</th>
                    <th className="p-2 text-left">Variant</th>
                    <th className="p-2 text-left">Qty</th>
                    <th className="p-2 text-left">Threshold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {alerts.map((a) => (
                    <tr key={a._id} className="hover:bg-gray-50">
                      <td className="p-2 font-semibold text-gray-800">
                        {a.productTitle}
                        <span className={`ml-2 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${a.critical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {a.critical ? 'Out' : 'Low'}
                        </span>
                      </td>
                      <td className="p-2 text-gray-500">{a.warehouseName} <span className="text-gray-400">({a.warehouseCode})</span></td>
                      <td className="p-2 text-gray-500">{a.variantKey || '—'}</td>
                      <td className="p-2 font-bold text-gray-800">{a.quantity}</td>
                      <td className="p-2 text-gray-500">{a.lowStockThreshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-teal-600" size={30} aria-hidden="true" /></div>
      ) : warehouses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <WarehouseIcon size={36} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
          <p className="font-semibold text-gray-600">No warehouses yet</p>
          <p className="text-sm text-gray-400 mt-1">Create a hub to start tracking per-warehouse stock.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Warehouse</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">SKUs</th>
                  <th className="p-3">Units</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {warehouses.map((w) => (
                  <tr key={w._id} className={`hover:bg-gray-50 ${active?._id === w._id ? 'bg-teal-50/50' : ''}`}>
                    <td className="p-3">
                      <button onClick={() => openWarehouse(w)} className="text-left group">
                        <p className="font-bold text-gray-800 group-hover:text-teal-600">{w.name}</p>
                        {w.managerName && <p className="text-xs text-gray-400">{w.managerName}</p>}
                      </button>
                    </td>
                    <td className="p-3 font-bold tracking-widest text-gray-500">{w.code}</td>
                    <td className="p-3 text-gray-600">{w.city}, {w.state}</td>
                    <td className="p-3 text-gray-600">{w.skuCount ?? 0}</td>
                    <td className="p-3 text-gray-600">{w.totalUnits ?? 0}</td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleActive(w)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          w.isActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}
                      >
                        {w.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openWarehouse(w)} className="p-2 text-gray-400 hover:text-teal-600 rounded-lg hover:bg-teal-50" aria-label="View inventory">
                          <Package size={16} aria-hidden="true" />
                        </button>
                        <button onClick={() => openEdit(w)} className="p-2 text-gray-400 hover:text-teal-600 rounded-lg hover:bg-teal-50" aria-label="Edit">
                          <Edit size={16} aria-hidden="true" />
                        </button>
                        <button onClick={() => handleDelete(w)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" aria-label="Delete">
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600">
              <History size={18} aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-bold text-gray-800">Stock ledger</h3>
              <p className="text-xs text-gray-500">Latest movements across every warehouse — transfers and adjustments. Immutable audit trail.</p>
            </div>
          </div>
          <span className="text-xs font-bold text-gray-400">{ledger.length} entries</span>
        </div>

        {ledgerLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" size={24} aria-hidden="true" /></div>
        ) : ledger.length === 0 ? (
          <div className="p-10 text-center">
            <History size={28} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
            <p className="font-semibold text-gray-600">No movements yet</p>
            <p className="text-sm text-gray-400 mt-1">Edits and transfers will appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Variant</th>
                  <th className="p-3">Warehouse</th>
                  <th className="p-3">Qty Δ</th>
                  <th className="p-3">Balance</th>
                  <th className="p-3">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledger.map((tx) => (
                  <tr key={tx._id} className="hover:bg-gray-50">
                    <td className="p-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(tx.createdAt)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                        tx.type === 'transfer_in'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : tx.type === 'transfer_out'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                        {tx.type === 'adjustment' ? 'Adjustment' : tx.type === 'transfer_in' ? 'Transfer in' : 'Transfer out'}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="font-semibold text-gray-800 max-w-[200px] truncate" title={tx.productTitle}>{tx.productTitle || 'Unknown product'}</p>
                    </td>
                    <td className="p-3">
                      {tx.variantKey ? <span className="px-2 py-0.5 rounded bg-gray-100 text-xs font-semibold text-gray-600">{tx.variantKey}</span> : <span className="text-xs text-gray-400">Base</span>}
                    </td>
                    <td className="p-3">
                      <span className="text-gray-600">{tx.warehouseName || '—'}</span>
                      {tx.oppositeWarehouseName && (
                        <span className="text-gray-400 text-xs"> ⇄ {tx.oppositeWarehouseName}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`font-bold ${tx.quantityDelta < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {tx.quantityDelta > 0 ? `+${tx.quantityDelta}` : tx.quantityDelta}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-gray-700">{tx.balanceAfter}</td>
                    <td className="p-3 text-xs text-gray-400 max-w-[180px] truncate">{tx.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {active && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-teal-50 text-teal-600">
                <Package size={18} aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-bold text-gray-800">{active.name} — Inventory</h3>
                <p className="text-xs text-gray-500">Per-product stock at this warehouse. Edits resync the sellable number automatically.</p>
              </div>
            </div>
            <input
              value={invSearch}
              onChange={(e) => setInvSearch(e.target.value)}
              placeholder="Search products…"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {invLoading ? (
            <div className="flex justify-center py-14"><Loader2 className="animate-spin text-teal-600" size={26} aria-hidden="true" /></div>
          ) : inventory.length === 0 ? (
            <div className="p-10 text-center">
              <Package size={32} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
              <p className="font-semibold text-gray-600">{invSearch ? 'No matching products' : 'No stock tracked here yet'}</p>
              <p className="text-sm text-gray-400 mt-1">
                {invSearch
                  ? 'Try a different search term.'
                  : 'Stock is created from the Products tab: any product with stock gains inventory rows across warehouses on resync.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">Variant</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Stock at hub</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventory.map((row) => (
                    <tr key={row._id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {row.productImage ? (
                            <img src={row.productImage} alt="" className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <span className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400"><Package size={16} aria-hidden="true" /></span>
                          )}
                          <div>
                            <p className="font-bold text-gray-800 max-w-[220px] truncate" title={row.productTitle}>{row.productTitle}</p>
                            <p className="text-xs text-gray-400"></p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {row.variantKey ? (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-xs font-semibold text-gray-600">{row.variantKey}</span>
                        ) : (
                          <span className="text-xs text-gray-400">Base</span>
                        )}
                      </td>
                      <td className="p-3 text-gray-600 capitalize">{row.productCategory}</td>
                      <td className="p-3 text-gray-600">{formatPrice(row.productPrice)}</td>
                      <td className="p-3">
                        {editingStock !== null && editingStock.rowId === row._id ? (
                          <input
                            type="number"
                            min={0}
                            value={editingStock.quantity}
                            autoFocus
                            onChange={(e) => setEditingStock({ rowId: row._id, quantity: Number(e.target.value) || 0 })}
                            className="w-24 px-3 py-1.5 border border-teal-400 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                          />
                        ) : (
                          <span className={`font-bold ${row.quantity <= 0 ? 'text-red-600' : 'text-gray-800'}`}>{row.quantity}</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          {editingStock !== null && editingStock.rowId === row._id ? (
                            <>
                              <button
                                onClick={() => saveStock(row)}
                                disabled={stockSavingId === row._id}
                                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                              >
                                {stockSavingId === row._id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : 'Save'}
                              </button>
                              <button
                                onClick={() => { setEditingStock(null); }}
                                className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 text-xs font-bold rounded-lg"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setEditingStock({ rowId: row._id, quantity: row.quantity })}
                              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:border-teal-300 text-gray-600 text-xs font-bold rounded-lg hover:bg-teal-50"
                            >
                              <ArrowDownUp size={13} aria-hidden="true" /> Update
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-label="Transfer stock">
          <form onSubmit={submitTransfer} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ArrowLeftRight size={18} className="text-indigo-600" aria-hidden="true" /> Transfer stock
              </h3>
              <button type="button" onClick={() => setShowTransfer(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg" aria-label="Close">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {transferLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" size={24} aria-hidden="true" /></div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="x-product" className="block text-sm font-medium text-gray-600 mb-1">Product *</label>
                  <select id="x-product" value={transferForm.productId} onChange={(e) => setTransferForm({ ...transferForm, productId: e.target.value, variantKey: '' })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm">
                    <option value="">Select product…</option>
                    {transferLines.map((p) => (
                      <option key={p._id} value={p._id}>{p.title}</option>
                    ))}
                  </select>
                </div>

                {selectedTransferProduct?.variants?.length > 0 && (
                  <div>
                    <label htmlFor="x-variant" className="block text-sm font-medium text-gray-600 mb-1">Variant *</label>
                    <select id="x-variant" value={transferForm.variantKey} onChange={(e) => setTransferForm({ ...transferForm, variantKey: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm">
                      <option value="">Select variant…</option>
                      {transferVariantKeys.map((vk, i) => (
                        <option key={i} value={vk}>{vk}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="x-from" className="block text-sm font-medium text-gray-600 mb-1">From (source) *</label>
                    <select id="x-from" value={transferForm.from} onChange={(e) => setTransferForm({ ...transferForm, from: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm">
                      <option value="">Select source…</option>
                      {transferWhs.filter((w) => w._id !== transferForm.to).map((w) => (
                        <option key={w._id} value={w._id}>{w.name} ({w.code})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="x-to" className="block text-sm font-medium text-gray-600 mb-1">To (destination) *</label>
                    <select id="x-to" value={transferForm.to} onChange={(e) => setTransferForm({ ...transferForm, to: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm">
                      <option value="">Select destination…</option>
                      {transferWhs.filter((w) => w._id !== transferForm.from).map((w) => (
                        <option key={w._id} value={w._id}>{w.name} ({w.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="x-qty" className="block text-sm font-medium text-gray-600 mb-1">Quantity *</label>
                  <input id="x-qty" type="number" min={1} value={transferForm.quantity} onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })} placeholder="Units to move" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm" />
                </div>

                <div>
                  <label htmlFor="x-note" className="block text-sm font-medium text-gray-600 mb-1">Note</label>
                  <input id="x-note" value={transferForm.note} onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })} maxLength={300} placeholder="Optional reference" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm" />
                </div>

                <div className="flex justify-end gap-2 mt-2">
                  <button type="button" onClick={() => setShowTransfer(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={transferSubmitting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                    {transferSubmitting ? 'Transferring…' : 'Transfer stock'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-label="Warehouse form">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">{editingId ? 'Edit warehouse' : 'Add warehouse'}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg" aria-label="Close">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="wh-name" className="block text-sm font-medium text-gray-600 mb-1">Name *</label>
                  <input id="wh-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm" />
                </div>
                <div>
                  <label htmlFor="wh-code" className="block text-sm font-medium text-gray-600 mb-1">Code *</label>
                  <input id="wh-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={10} required placeholder="DEL" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm uppercase" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="wh-city" className="block text-sm font-medium text-gray-600 mb-1">City *</label>
                  <input id="wh-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={60} required className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm" />
                </div>
                <div>
                  <label htmlFor="wh-state" className="block text-sm font-medium text-gray-600 mb-1">State *</label>
                  <input id="wh-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={60} required className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="wh-addr" className="block text-sm font-medium text-gray-600 mb-1">Address</label>
                <input id="wh-addr" value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} maxLength={300} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm" />
              </div>
              <div>
                <label htmlFor="wh-mgr" className="block text-sm font-medium text-gray-600 mb-1">Manager name</label>
                <input id="wh-mgr" value={form.managerName} onChange={(e) => setForm({ ...form, managerName: e.target.value })} maxLength={80} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm" />
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500" />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          show={confirmModal.show}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          cancelLabel={confirmModal.cancelLabel}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

export default AdminWarehousesTab;