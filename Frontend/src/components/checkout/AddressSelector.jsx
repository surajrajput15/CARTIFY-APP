import { useState } from 'react';
import { MapPin, CheckCircle, Plus, AlertCircle, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { EmptyProductsIllustration } from '../illustrations/EmptyStateIllustrations';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../Modal';
import LocationPicker from '../profile/LocationPicker';
import { normalizeIndianPhone, normalizePinCode } from '../../utils/normalize';
import { handleApiError } from '../../utils/apiError';

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  pinCode: '',
  latitude: null,
  longitude: null,
};

const isValidIndianPhone = (phone) => /^[6-9]\d{9}$/.test(phone);
const isValidPinCode = (pinCode) => /^[1-9][0-9]{5}$/.test(pinCode);

const AddressSelector = ({ addresses, loading, error, selectedAddress, onSelect, onGoToProfile, onRetry, onSaveAddress }) => {
  const isSelectedPhoneValid = selectedAddress ? Boolean(normalizeIndianPhone(selectedAddress.phone)) : true;
  const isSelectedPinValid = selectedAddress ? Boolean(normalizePinCode(selectedAddress.pinCode)) : true;

  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [phoneError, setPhoneError] = useState('');
  const [pinError, setPinError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setPhoneError('');
    setPinError('');
    setFormError('');
    setShowMap(false);
    setShowAddModal(false);
  };

  const handlePin = ({ latitude, longitude }) => {
    setFormData((prev) => ({ ...prev, latitude, longitude }));
  };

  const handleAddressResolved = (result) => {
    setFormData((prev) => ({
      ...prev,
      street: prev.street || result.street || '',
      city: prev.city || result.city || '',
      state: prev.state || result.state || '',
      pinCode: prev.pinCode || result.pinCode || '',
    }));
  };

  const handleSubmitAddress = async (e) => {
    e.preventDefault();
    setPhoneError('');
    setPinError('');
    setFormError('');

    const trimmed = {
      fullName: formData.fullName.trim(),
      phone: formData.phone.trim(),
      street: formData.street.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      pinCode: formData.pinCode.trim(),
      latitude: formData.latitude,
      longitude: formData.longitude,
    };

    if (!isValidIndianPhone(trimmed.phone)) {
      setPhoneError('Enter a valid 10-digit Indian phone number starting with 6, 7, 8, or 9');
      return;
    }
    if (!isValidPinCode(trimmed.pinCode)) {
      setPinError('Enter a valid 6-digit PIN code');
      return;
    }

    if (!onSaveAddress) return;

    setSaving(true);
    try {
      const saved = await onSaveAddress(trimmed);
      toast.success('Delivery address added!');
      resetForm();
      if (saved && onSelect) {
        onSelect(saved);
      }
    } catch (err) {
      setFormError(handleApiError(err, 'Failed to save address. Please check your details and try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6" aria-labelledby="address-selector-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 id="address-selector-heading" className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
          <MapPin className="text-teal-600" aria-hidden="true" /> Select Delivery Address
        </h2>
        <div className="flex items-center gap-2">
          {onSaveAddress && addresses.length < 10 && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="text-xs sm:text-sm font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl flex items-center gap-1 min-h-[36px] transition-colors"
            >
              <Plus size={15} aria-hidden="true" /> Add New Address
            </button>
          )}
          {addresses.length > 0 && onGoToProfile && (
            <button
              type="button"
              onClick={onGoToProfile}
              className="text-xs sm:text-sm font-semibold text-gray-500 hover:text-teal-600 flex items-center gap-1 min-h-[36px]"
            >
              Manage in Profile
            </button>
          )}
        </div>
      </div>

      {selectedAddress && (!isSelectedPhoneValid || !isSelectedPinValid) && (
        <div role="alert" className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs sm:text-sm flex items-start gap-2.5 animate-fade-in-up">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-bold">Invalid Delivery Details on Selected Address</p>
            {!isSelectedPhoneValid && (
              <p className="mt-0.5">
                Phone number <strong>"{selectedAddress.phone || 'missing'}"</strong> is invalid. Indian mobile numbers must be 10 digits starting with 6, 7, 8, or 9.
              </p>
            )}
            {!isSelectedPinValid && (
              <p className="mt-0.5">
                PIN code <strong>"{selectedAddress.pinCode || 'missing'}"</strong> is invalid. It must be a 6-digit postal code.
              </p>
            )}
            {onGoToProfile && (
              <button
                type="button"
                onClick={onGoToProfile}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-teal-700 underline hover:text-teal-800"
              >
                Update this address in Profile →
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse" aria-label="Loading addresses">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-start p-4 border border-gray-100 rounded-xl">
              <div className="w-4 h-4 bg-gray-200 rounded-full mt-1"></div>
              <div className="ml-3 flex-1 space-y-2">
                <div className="h-4 w-40 bg-gray-200 rounded"></div>
                <div className="h-3 w-56 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error && addresses.length === 0 ? (
        <div role="alert" className="text-center py-6 sm:py-8 bg-red-50 rounded-xl border border-red-200 px-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" aria-hidden="true" />
          <p className="text-gray-700 font-bold mb-1 text-sm sm:text-base">Couldn't load your addresses</p>
          <p className="text-gray-500 text-sm mb-4">Check your connection and try again.</p>
          {onRetry && (
            <Button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-colors min-h-[44px]"
            >
              Retry
            </Button>
          )}
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-xl border border-gray-200 px-4">
          <EmptyProductsIllustration className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 opacity-80" />
          <p className="text-gray-600 mb-4 text-sm sm:text-base font-medium">You don't have any saved addresses yet.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onSaveAddress && (
              <Button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-colors min-h-[44px]"
              >
                <Plus size={18} aria-hidden="true" /> Add Delivery Address
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onGoToProfile}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-colors min-h-[44px]"
            >
              Add Address in Profile
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3" role="radiogroup" aria-labelledby="address-selector-heading">
          {addresses.map((addr) => {
            const isSelected = selectedAddress?._id === addr._id;
            const phoneValid = Boolean(normalizeIndianPhone(addr.phone));
            const pinValid = Boolean(normalizePinCode(addr.pinCode));
            return (
              <label
                key={addr._id}
                className={`flex items-start p-3 sm:p-4 border rounded-xl cursor-pointer transition-colors min-h-[64px] ${
                  isSelected ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300'
                } ${(!phoneValid || !pinValid) ? 'ring-1 ring-amber-300' : ''}`}
              >
                <input
                  type="radio"
                  name="address"
                  className="mt-1 w-4 h-4 text-teal-600 focus:ring-teal-500"
                  checked={isSelected}
                  onChange={() => onSelect(addr)}
                  aria-label={`Deliver to ${addr.fullName}, ${addr.street}, ${addr.city}`}
                />
                <div className="ml-3 flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">
                    {addr.fullName}
                    <span className="font-normal text-gray-500 ml-2 text-sm">{addr.phone}</span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1 break-words">
                    {addr.street}, {addr.city}, {addr.state} - {addr.pinCode}
                  </p>
                  {!phoneValid && (
                    <p className="text-xs text-amber-700 bg-amber-100/60 rounded px-2 py-0.5 mt-1 font-medium inline-block">
                      ⚠️ Phone "{addr.phone || 'missing'}" invalid (needs 10 digits starting with 6-9)
                    </p>
                  )}
                  {!pinValid && (
                    <p className="text-xs text-amber-700 bg-amber-100/60 rounded px-2 py-0.5 mt-1 font-medium inline-block ml-1">
                      ⚠️ PIN "{addr.pinCode || 'missing'}" invalid (needs 6 digits)
                    </p>
                  )}
                </div>
                {isSelected && <CheckCircle className="text-teal-600 flex-shrink-0" size={20} aria-hidden="true" />}
              </label>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <Modal
          title="Add Delivery Address"
          onClose={resetForm}
          className="max-w-lg p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="text-teal-600" size={20} aria-hidden="true" /> Add Delivery Address
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label="Close modal"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {formError && (
            <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" aria-hidden="true" />
              <p>{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmitAddress} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="address-fullName" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  id="address-fullName"
                  type="text"
                  placeholder="e.g. Suraj Kumar"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                  className="p-2.5 rounded-lg text-sm w-full"
                />
              </div>

              <div>
                <label htmlFor="address-phone" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="address-phone"
                  type="tel"
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={formData.phone}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData((prev) => ({ ...prev, phone: v }));
                    setPhoneError('');
                  }}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={phoneError ? 'inline-phone-error' : undefined}
                  className={`p-2.5 rounded-lg border w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    phoneError ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                  }`}
                />
                {phoneError && (
                  <p id="inline-phone-error" role="alert" className="text-red-500 text-xs mt-1">
                    {phoneError}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="address-street" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Street / Flat / Colony <span className="text-red-500">*</span>
              </label>
              <Input
                id="address-street"
                type="text"
                placeholder="Flat / House no, Building name, Street"
                required
                value={formData.street}
                onChange={(e) => setFormData((prev) => ({ ...prev, street: e.target.value }))}
                className="p-2.5 rounded-lg text-sm w-full"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="address-city" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <Input
                  id="address-city"
                  type="text"
                  placeholder="e.g. Jaipur"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                  className="p-2.5 rounded-lg text-sm w-full"
                />
              </div>

              <div>
                <label htmlFor="address-state" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <Input
                  id="address-state"
                  type="text"
                  placeholder="e.g. Rajasthan"
                  required
                  value={formData.state}
                  onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                  className="p-2.5 rounded-lg text-sm w-full"
                />
              </div>

              <div>
                <label htmlFor="address-pincode" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  PIN Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="address-pincode"
                  type="text"
                  placeholder="6 digits"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={formData.pinCode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setFormData((prev) => ({ ...prev, pinCode: v }));
                    setPinError('');
                  }}
                  aria-invalid={Boolean(pinError)}
                  aria-describedby={pinError ? 'inline-pin-error' : undefined}
                  className={`p-2.5 rounded-lg border w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    pinError ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
                  }`}
                />
                {pinError && (
                  <p id="inline-pin-error" role="alert" className="text-red-500 text-xs mt-1">
                    {pinError}
                  </p>
                )}
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowMap((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 transition-colors"
              >
                <MapPin size={15} aria-hidden="true" />
                {showMap ? 'Hide map pin' : 'Pin precise location on map (optional)'}
              </button>
              {showMap && (
                <div className="mt-2 border rounded-xl overflow-hidden">
                  <LocationPicker
                    latitude={formData.latitude}
                    longitude={formData.longitude}
                    onPick={handlePin}
                    onAddressResolved={handleAddressResolved}
                  />
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <Button
                type="submit"
                disabled={saving}
                className="px-5 py-2 text-sm font-bold rounded-xl transition-colors min-h-[44px] flex items-center gap-2"
              >
                {saving ? 'Saving Address...' : 'Save & Deliver Here'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
};

export default AddressSelector;
