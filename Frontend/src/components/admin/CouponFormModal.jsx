import { useState } from 'react';
import toast from 'react-hot-toast';
import { createCoupon, updateCoupon } from '../../services/couponsApi';
import Modal from '../Modal';

const EMPTY = { code: '', type: 'percentage', value: '', minOrderAmount: 0, maxDiscount: '', usageLimit: '', userLimit: 1, validFrom: '', validUntil: '', isActive: true, applicableCategories: '' };

// Convert an ISO timestamp to a yyyy-mm-dd string in the ADMIN's local timezone
// so edit fields show exactly the local dates the admin originally chose.
const toDateInputValue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// "Valid from" day starts at local midnight; "valid until" day runs through
// local 23:59:59.999. Without the end-of-day clamp, a coupon "valid until
// Dec 31" dies at 00:00 UTC Dec 31 — hours before the day is over.
const toLocalStartOfDay = (dateStr) => {
  const [y, m, dd] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, dd, 0, 0, 0, 0);
};
const toLocalEndOfDay = (dateStr) => {
  const [y, m, dd] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, dd, 23, 59, 59, 999);
};

const buildInitialForm = (editing) => (editing
  ? {
      code: editing.code || '',
      type: editing.type || 'percentage',
      value: editing.value ?? '',
      minOrderAmount: editing.minOrderAmount ?? 0,
      maxDiscount: editing.maxDiscount ?? '',
      usageLimit: editing.usageLimit ?? '',
      userLimit: editing.userLimit ?? 1,
      validFrom: toDateInputValue(editing.validFrom),
      validUntil: toDateInputValue(editing.validUntil),
      isActive: editing.isActive ?? true,
      applicableCategories: (editing.applicableCategories || []).join(', '),
    }
  : EMPTY);

const CouponFormModal = ({ editing, onClose, onSaved }) => {
  const [form, setForm] = useState(() => buildInitialForm(editing));
  const [saving, setSaving] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (!form.code.trim() || form.code.trim().length < 3) return toast.error('Code must be at least 3 chars');
    if (!form.validUntil) return toast.error('Valid until required');
    if (form.validFrom && toLocalEndOfDay(form.validFrom) > toLocalEndOfDay(form.validUntil)) {
      return toast.error('Valid until must be on or after valid from');
    }
    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      minOrderAmount: Number(form.minOrderAmount) || 0,
      maxDiscount: form.maxDiscount === '' ? null : Number(form.maxDiscount),
      usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
      userLimit: Number(form.userLimit) || 1,
      validFrom: form.validFrom ? toLocalStartOfDay(form.validFrom) : undefined,
      validUntil: toLocalEndOfDay(form.validUntil),
      isActive: form.isActive,
      applicableCategories: form.applicableCategories ? form.applicableCategories.split(',').map(s=>s.trim()).filter(Boolean) : [],
    };
    setSaving(true);
    try {
      if (editing) await updateCoupon(editing._id, payload);
      else await createCoupon(payload);
      toast.success(editing ? 'Coupon updated' : 'Coupon created');
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.response?.data?.errors?.join(', ') || 'Failed to save coupon');
    } finally { setSaving(false); }
  };

  return (
    <Modal title={editing ? 'Edit Coupon' : 'Add Coupon'} onClose={onClose} className="max-w-lg p-6">
      <form onSubmit={handle} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input value={form.code} onChange={e=>setForm({...form, code: e.target.value.toUpperCase()})} placeholder="Code e.g. SAVE20" className="p-3 border rounded-lg font-bold tracking-wider uppercase" required minLength={3} aria-label="Coupon code" />
          <select value={form.type} onChange={e=>setForm({...form, type: e.target.value})} className="p-3 border rounded-lg">
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed (₹)</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" step="0.01" value={form.value} onChange={e=>setForm({...form, value: e.target.value})} placeholder={form.type==='percentage'?'Value %':'Value ₹'} className="p-3 border rounded-lg" required />
          <input type="number" value={form.minOrderAmount} onChange={e=>setForm({...form, minOrderAmount: e.target.value})} placeholder="Min order ₹ (0 = none)" className="p-3 border rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={form.maxDiscount} onChange={e=>setForm({...form, maxDiscount: e.target.value})} placeholder="Max discount ₹ (optional)" className="p-3 border rounded-lg" />
          <input type="number" value={form.usageLimit} onChange={e=>setForm({...form, usageLimit: e.target.value})} placeholder="Global limit (blank = unlimited)" className="p-3 border rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={form.userLimit} onChange={e=>setForm({...form, userLimit: e.target.value})} placeholder="Per-user limit" className="p-3 border rounded-lg" required min={1} />
          <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e=>setForm({...form, isActive: e.target.checked})} /> Active
          </label>
        </div>
        <input value={form.applicableCategories} onChange={e=>setForm({...form, applicableCategories: e.target.value})} placeholder="Categories comma separated (e.g. electronics,beauty) blank = all" className="w-full p-3 border rounded-lg" />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs">Valid From<input type="date" value={form.validFrom} onChange={e=>setForm({...form, validFrom: e.target.value})} className="w-full p-3 border rounded-lg mt-1" /></label>
          <label className="text-xs">Valid Until*<input type="date" value={form.validUntil} onChange={e=>setForm({...form, validUntil: e.target.value})} className="w-full p-3 border rounded-lg mt-1" required /></label>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50 min-h-[44px]">{saving?'Saving...': editing?'Update':'Create'}</button>
          <button type="button" onClick={onClose} className="flex-1 bg-gray-100 py-3 rounded-lg font-bold hover:bg-gray-200 min-h-[44px]">Cancel</button>
        </div>
      </form>
    </Modal>
  );
};

export default CouponFormModal;
