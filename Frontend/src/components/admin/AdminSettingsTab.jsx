import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Mail, Truck,
  Bell, Save, Loader2, CheckCircle2, Lock
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import { isNetworkError } from '../../utils/apiError';
import Button from '../ui/Button';

const DEFAULT_SETTINGS = {
  storeName: 'Cartify',
  supportEmail: 'support@cartify.com',
  supportPhone: '+91 98765 43210',
  currency: 'INR',
  currencySymbol: '₹',
  shippingFee: 40,
  freeShippingThreshold: 500,
  defaultLowStockThreshold: 5,
  orderAutoCancelMinutes: 1440,
  systemNotificationsEnabled: true,
  emailNotificationsEnabled: true
};

export default function AdminSettingsTab() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('general');

  const loadSettings = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await api.get('/api/v1/admin/settings');
      if (res.data?.settings) {
        setSettings(res.data.settings);
      }
    } catch (err) {
      if (!isNetworkError(err)) {
        toast.error('Failed to load store settings; using current system values');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial mount fetch
    loadSettings();
  }, [loadSettings]);

  const handleChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        storeName: settings.storeName.trim(),
        supportEmail: settings.supportEmail.trim(),
        supportPhone: settings.supportPhone.trim(),
        currency: settings.currency.trim(),
        currencySymbol: settings.currencySymbol.trim(),
        shippingFee: Number(settings.shippingFee),
        freeShippingThreshold: Number(settings.freeShippingThreshold),
        defaultLowStockThreshold: Number(settings.defaultLowStockThreshold),
        orderAutoCancelMinutes: Number(settings.orderAutoCancelMinutes),
        systemNotificationsEnabled: Boolean(settings.systemNotificationsEnabled),
        emailNotificationsEnabled: Boolean(settings.emailNotificationsEnabled)
      };

      const res = await api.put('/api/v1/admin/settings', payload);
      if (res.data?.settings) {
        setSettings(res.data.settings);
      }
      toast.success('Store settings saved successfully');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update store settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3" role="status" aria-label="Loading settings">
        <Loader2 size={32} className="animate-spin text-teal-600" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-500">Loading store configuration…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">System & Store Settings</h2>
          <p className="text-xs sm:text-sm text-gray-500">Manage store operations, fulfillment parameters, and security policies</p>
        </div>
      </header>

      {/* SECTION TABS */}
      <div className="flex border-b border-gray-200 overflow-x-auto gap-4">
        <button
          type="button"
          onClick={() => setActiveSection('general')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
            activeSection === 'general' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Mail size={16} aria-hidden="true" /> General & Support
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('operations')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
            activeSection === 'operations' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Truck size={16} aria-hidden="true" /> Shipping & Inventory
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('notifications')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
            activeSection === 'notifications' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bell size={16} aria-hidden="true" /> Notification Channels
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('security')}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
            activeSection === 'security' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Shield size={16} aria-hidden="true" /> Security Architecture
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* GENERAL TAB */}
        {activeSection === 'general' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Mail className="text-teal-600" size={18} aria-hidden="true" /> Store Identity & Contact
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1" htmlFor="set-store-name">
                  Store Display Name
                </label>
                <input
                  id="set-store-name"
                  type="text"
                  value={settings.storeName || ''}
                  onChange={(e) => handleChange('storeName', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-teal-500 focus:border-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1" htmlFor="set-support-email">
                  Customer Support Email
                </label>
                <input
                  id="set-support-email"
                  type="email"
                  value={settings.supportEmail || ''}
                  onChange={(e) => handleChange('supportEmail', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-teal-500 focus:border-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1" htmlFor="set-support-phone">
                  Support Contact Phone
                </label>
                <input
                  id="set-support-phone"
                  type="text"
                  value={settings.supportPhone || ''}
                  onChange={(e) => handleChange('supportPhone', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-teal-500 focus:border-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1" htmlFor="set-currency">
                  Store Currency
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    id="set-currency"
                    type="text"
                    value={settings.currency || 'INR'}
                    onChange={(e) => handleChange('currency', e.target.value)}
                    placeholder="INR"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm uppercase focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                  <input
                    id="set-currency-symbol"
                    type="text"
                    value={settings.currencySymbol || '₹'}
                    onChange={(e) => handleChange('currencySymbol', e.target.value)}
                    placeholder="₹"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-teal-500 focus:border-teal-500"
                    required
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OPERATIONS TAB */}
        {activeSection === 'operations' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Truck className="text-teal-600" size={18} aria-hidden="true" /> Shipping & Inventory Rules
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1" htmlFor="set-shipping-fee">
                  Standard Shipping Fee (₹)
                </label>
                <input
                  id="set-shipping-fee"
                  type="number"
                  min="0"
                  value={settings.shippingFee ?? 40}
                  onChange={(e) => handleChange('shippingFee', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-teal-500 focus:border-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1" htmlFor="set-free-threshold">
                  Free Shipping Threshold (₹)
                </label>
                <input
                  id="set-free-threshold"
                  type="number"
                  min="0"
                  value={settings.freeShippingThreshold ?? 500}
                  onChange={(e) => handleChange('freeShippingThreshold', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-teal-500 focus:border-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1" htmlFor="set-stock-thresh">
                  Default Low Stock Alert Threshold (Units)
                </label>
                <input
                  id="set-stock-thresh"
                  type="number"
                  min="1"
                  value={settings.defaultLowStockThreshold ?? 5}
                  onChange={(e) => handleChange('defaultLowStockThreshold', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-teal-500 focus:border-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1" htmlFor="set-cancel-mins">
                  Unpaid Order Auto-Purge Expiry (Minutes)
                </label>
                <input
                  id="set-cancel-mins"
                  type="number"
                  min="15"
                  value={settings.orderAutoCancelMinutes ?? 1440}
                  onChange={(e) => handleChange('orderAutoCancelMinutes', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-teal-500 focus:border-teal-500"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeSection === 'notifications' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Bell className="text-teal-600" size={18} aria-hidden="true" /> System Notification Preferences
            </h3>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.systemNotificationsEnabled)}
                  onChange={(e) => handleChange('systemNotificationsEnabled', e.target.checked)}
                  className="mt-1 w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                />
                <div>
                  <span className="text-sm font-bold text-gray-900">In-App Broadcast Notifications</span>
                  <p className="text-xs text-gray-500">Enable real-time push alerts for order updates and customer notifications</p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.emailNotificationsEnabled)}
                  onChange={(e) => handleChange('emailNotificationsEnabled', e.target.checked)}
                  className="mt-1 w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                />
                <div>
                  <span className="text-sm font-bold text-gray-900">Transactional Email Service</span>
                  <p className="text-xs text-gray-500">Send order placement confirmations and password recovery messages to customers</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* SECURITY ARCHITECTURE TAB */}
        {activeSection === 'security' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Shield className="text-teal-600" size={18} aria-hidden="true" /> Security & Protection Controls
            </h3>
            <p className="text-xs text-gray-500">Production safety standards enforced across the Cartify API layer</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3.5 bg-gray-50 rounded-xl">
                <span className="text-xs font-bold text-gray-500 uppercase block">Authentication</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 size={15} aria-hidden="true" /> JWT with HttpOnly cookie rotation
                </span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl">
                <span className="text-xs font-bold text-gray-500 uppercase block">CSRF Defence</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 size={15} aria-hidden="true" /> Double-submit cookie & SameSite policy
                </span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl">
                <span className="text-xs font-bold text-gray-500 uppercase block">API Abuse Guard</span>
                <span className="font-semibold text-teal-700 flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 size={15} aria-hidden="true" /> Rate limiting: 200/min general · 5/min auth
                </span>
              </div>
              <div className="p-3.5 bg-gray-50 rounded-xl">
                <span className="text-xs font-bold text-gray-500 uppercase block">Audit Trail</span>
                <span className="font-semibold text-blue-700 flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 size={15} aria-hidden="true" /> Comprehensive audit logging enabled
                </span>
              </div>
            </div>
            <div className="p-3 bg-teal-50/60 rounded-xl text-xs text-teal-900 flex items-center gap-2 border border-teal-100">
              <Lock size={15} className="text-teal-700 shrink-0" aria-hidden="true" />
              <span>Sensitive server environment variables and secrets are isolated securely and never exposed to the client.</span>
            </div>
          </div>
        )}

        {activeSection !== 'security' && (
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl font-bold text-sm inline-flex items-center gap-2 min-h-[44px]"
            >
              {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              <span>{saving ? 'Saving Changes…' : 'Save Settings'}</span>
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}