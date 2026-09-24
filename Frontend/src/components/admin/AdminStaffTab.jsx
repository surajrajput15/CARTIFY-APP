import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Loader2, Trash2, Truck, Warehouse, Mail, Phone, MapPin, X, UserCircle2 } from 'lucide-react';
import { fetchStaff, createStaff, updateStaff, demoteStaff } from '../../services/staffApi';
import { fetchWarehouses } from '../../services/warehousesApi';
import { isNetworkError } from '../../utils/apiError';
import { formatDate } from '../../utils/format';

const EMPTY_FORM = { name: '', email: '', password: '', role: 'delivery', phone: '', warehouseId: '' };

function AdminStaffTab() {
  const [staff, setStaff] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmId, setConfirmId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchStaff();
      setStaff(res.data.staff || []);
    } catch (err) {
      if (!isNetworkError(err)) toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await fetchWarehouses();
      setWarehouses(res.data.warehouses || []);
    } catch {
      // Non-blocking — form just won't have a picker.
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadWarehouses(); }, [loadWarehouses]);

  const validate = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Valid email is required'); return false; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return false; }
    if (form.role === 'warehouse' && !form.warehouseId) { toast.error('Select a warehouse for warehouse staff'); return false; }
    return true;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await createStaff({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        phone: form.phone.trim() || undefined,
        warehouseId: form.role === 'warehouse' ? form.warehouseId : undefined,
      });
      toast.success('Staff account created');
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create staff');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignWarehouse = async (person, warehouseId) => {
    setSaving(person._id);
    try {
      await updateStaff(person._id, { warehouseId });
      toast.success('Warehouse assigned');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to assign warehouse');
    } finally {
      setSaving(null);
    }
  };

  const handleDemote = async (person) => {
    if (!window.confirm(`Demote "${person.name}" back to a customer? They lose portal access.`)) return;
    setSaving(person._id);
    try {
      await demoteStaff(person._id);
      toast.success('Staff demoted to customer');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to demote staff');
    } finally {
      setSaving(null);
    }
  };

  const picker = (person) => {
    if (person.role !== 'warehouse') return null;
    const activeId = person.assignedWarehouseId?._id || person.assignedWarehouseId;
    return (
      <div className="flex items-center gap-2 mt-2">
        <select
          value={activeId || ''}
          onChange={(e) => handleAssignWarehouse(person, e.target.value)}
          disabled={saving === person._id}
          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-gray-50 disabled:opacity-60"
          aria-label={`Assign warehouse for ${person.name}`}
        >
          <option value="">Assign warehouse…</option>
          {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name} ({w.code})</option>)}
        </select>
        {activeId && (
          <button onClick={() => handleAssignWarehouse(person, null)} className="text-[11px] font-bold text-gray-400 hover:text-red-500 px-2 py-1 rounded" aria-label={`Unassign ${person.name}`}>
            Unassign
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-label="Loading staff">
        <Loader2 size={28} className="animate-spin text-teal-600" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Staff Accounts</h2>
          <p className="text-sm text-gray-500 mt-0.5">Delivery partners and warehouse staff are created here — public registration is customer-only.</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl inline-flex items-center gap-2 min-h-[44px]">
          {showForm ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
          {showForm ? 'Close' : 'Add Staff'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="sf-name">Full name</label>
            <input id="sf-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="sf-email">Email</label>
            <input id="sf-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="sf-password">Temporary password</label>
            <input id="sf-password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 8 characters" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="sf-role">Role</label>
            <select id="sf-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="delivery">Delivery Partner</option>
              <option value="warehouse">Warehouse Staff</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="sf-phone">Phone (optional)</label>
            <input id="sf-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          {form.role === 'warehouse' && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1" htmlFor="sf-wh">Warehouse</label>
              <select id="sf-wh" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" required>
                <option value="">Select warehouse…</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name} ({w.code})</option>)}
              </select>
            </div>
          )}
          <div className="sm:col-span-2 flex items-center gap-2">
            <button type="submit" disabled={saving} className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl inline-flex items-center gap-2 min-h-[44px]">
              {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />} Create Account
            </button>
            <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 rounded-xl min-h-[44px]">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {staff.length === 0 && (
          <div className="sm:col-span-2 xl:col-span-3 bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
            No staff yet — add your first delivery partner or warehouse keeper above.
          </div>
        )}
        {staff.map((person) => (
          <div key={person._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${person.role === 'warehouse' ? 'bg-teal-50 text-teal-600' : 'bg-blue-50 text-blue-600'}`} aria-hidden="true">
                {person.role === 'warehouse' ? <Warehouse size={20} /> : <Truck size={20} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 truncate">{person.name}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1"><Mail size={11} aria-hidden="true" /> {person.email}</p>
                {person.phone && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Phone size={11} aria-hidden="true" /> {person.phone}</p>}
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold capitalize border ${person.role === 'warehouse' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                {person.role}
              </span>
            </div>

            {person.role === 'delivery' && (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-500 inline-flex items-center gap-1.5">
                <UserCircle2 size={13} aria-hidden="true" /> Delivery assignments handled on the Deliveries tab.
              </div>
            )}

            {person.role === 'warehouse' && (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-xs">
                {picker(person)}
                <p className="text-gray-500 mt-1 inline-flex items-center gap-1">
                  {person.assignedWarehouseId ? (
                    <><MapPin size={11} aria-hidden="true" /> {person.assignedWarehouseId.name} · {person.assignedWarehouseId.city}</>
                  ) : (
                    <span className="text-amber-600">No warehouse assigned yet</span>
                  )}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-gray-50 pt-2">
              <span className="text-[11px] text-gray-400">Since {formatDate(person.createdAt)}</span>
              <button onClick={() => handleDemote(person)} disabled={saving === person._id}
                className="text-[11px] font-bold text-gray-400 hover:text-red-600 px-2 py-1 rounded inline-flex items-center gap-1 disabled:opacity-50">
                {saving === person._id ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <Trash2 size={11} aria-hidden="true" />} Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminStaffTab;