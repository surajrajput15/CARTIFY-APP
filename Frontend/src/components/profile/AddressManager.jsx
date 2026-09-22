import { useState } from 'react';
import { Plus, Trash2, Edit, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import LocationPicker from './LocationPicker';

const EMPTY_ADDRESS = { fullName: '', phone: '', street: '', city: '', state: '', pinCode: '', latitude: null, longitude: null };

const isValidIndianPhone = (phone) => /^[6-9]\d{9}$/.test(phone);
const isValidPinCode = (pinCode) => /^[1-9][0-9]{5}$/.test(pinCode);

const editingAddressDefaults = {
  fullName: '', phone: '', street: '', city: '', state: '', pinCode: '', latitude: null, longitude: null
};

const AddressManager = ({ addresses, addressesLoading, onSaveAddress, onDeleteAddress }) => {
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [pinError, setPinError] = useState('');
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [editingAddress, setEditingAddress] = useState(editingAddressDefaults);
  const [showMap, setShowMap] = useState(false);

  const resetForm = () => {
    setShowAddressForm(false);
    setNewAddress(EMPTY_ADDRESS);
    setPhoneError('');
    setPinError('');
    setShowMap(false);
  };

  const handleOpenEdit = (id, address) => {
    setEditingAddressId(id);
    setEditingAddress({ ...address });
    setShowAddressForm(true);
    setShowMap(Boolean(address.latitude != null && address.longitude != null));
  };

  const handleCloseEdit = () => {
    setEditingAddressId(null);
    setEditingAddress(editingAddressDefaults);
    setShowAddressForm(false);
    setShowMap(false);
  };

  const updateActive = (patch) => {
    if (editingAddressId) setEditingAddress((prev) => ({ ...prev, ...patch }));
    else setNewAddress((prev) => ({ ...prev, ...patch }));
  };

  const handlePin = ({ latitude, longitude }) => updateActive({ latitude, longitude });

  const handleAddressResolved = (result) => {
    const current = editingAddressId ? editingAddress : newAddress;
    const patch = {};
    if (!current.street && result.street) patch.street = result.street;
    if (!current.city && result.city) patch.city = result.city;
    if (!current.state && result.state) patch.state = result.state;
    if (!current.pinCode && result.pinCode) patch.pinCode = result.pinCode;
    updateActive(patch);
  };

const handleSave = async (e) => {
    e.preventDefault();
    setPhoneError('');
    setPinError('');
    const addressToSave = editingAddressId ? { ...editingAddress, _id: editingAddressId } : newAddress;
    if (!isValidIndianPhone(addressToSave.phone)) {
      setPhoneError('Enter a valid 10-digit Indian phone number starting with 6, 7, 8, or 9');
      return;
    }
    if (!isValidPinCode(addressToSave.pinCode)) {
      setPinError('Enter a valid 6-digit PIN code');
      return;
    }
    setAddressSaving(true);
    try {
      await onSaveAddress(addressToSave);
      toast.success(editingAddressId ? 'Address updated' : 'Address saved');
      if (editingAddressId) {
        handleCloseEdit();
      } else {
        resetForm();
      }
    } catch {
      toast.error("Failed to save address");
    } finally {
      setAddressSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fade-in-up">
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Manage Addresses</h2>
        {!showAddressForm && (
          <button onClick={() => setShowAddressForm(true)} className="flex items-center gap-1 text-sm font-bold text-teal-600 hover:text-teal-700">
            <Plus size={16} aria-hidden="true" /> Add New
          </button>
        )}
      </div>

      {showAddressForm && (
        <form onSubmit={handleSave} className="mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
          <h3 className="font-bold text-gray-800 mb-4">
            {editingAddressId ? 'Update address' : 'Add a new address'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Full Name" aria-label="Full Name" required
              value={editingAddressId ? editingAddress.fullName : newAddress.fullName}
              onChange={(e) => editingAddressId
                ? setEditingAddress({...editingAddress, fullName: e.target.value})
                : setNewAddress({...newAddress, fullName: e.target.value})}
              className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500" />
            <div>
              <input type="tel" placeholder="Phone Number" aria-label="Phone Number" inputMode="numeric" maxLength={10} required
                value={editingAddressId ? editingAddress.phone : newAddress.phone}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                  if (editingAddressId) setEditingAddress({ ...editingAddress, phone: v });
                  else setNewAddress({ ...newAddress, phone: v });
                  setPhoneError('');
                }}
                aria-invalid={Boolean(phoneError)}
                aria-describedby={phoneError ? 'phone-error' : undefined}
                className={`p-3 rounded-lg border w-full focus:ring-teal-500 focus:border-teal-500 ${phoneError ? 'border-red-400' : ''}`} />
              {phoneError && <p id="phone-error" role="alert" className="text-red-500 text-xs mt-1">{phoneError}</p>}
            </div>
            <input type="text" placeholder="Street / Flat / Area" aria-label="Street, Flat or Area" required
              value={editingAddressId ? editingAddress.street : newAddress.street}
              onChange={(e) => editingAddressId
                ? setEditingAddress({...editingAddress, street: e.target.value})
                : setNewAddress({...newAddress, street: e.target.value})}
              className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500 md:col-span-2" />
            <input type="text" placeholder="City" aria-label="City" required
              value={editingAddressId ? editingAddress.city : newAddress.city}
              onChange={(e) => editingAddressId
                ? setEditingAddress({...editingAddress, city: e.target.value})
                : setNewAddress({...newAddress, city: e.target.value})}
              className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500" />
            <input type="text" placeholder="State" aria-label="State" required
              value={editingAddressId ? editingAddress.state : newAddress.state}
              onChange={(e) => editingAddressId
                ? setEditingAddress({...editingAddress, state: e.target.value})
                : setNewAddress({...newAddress, state: e.target.value})}
              className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500" />
            <div>
              <input type="text" placeholder="PIN Code" aria-label="PIN Code" inputMode="numeric" maxLength={6} required
                value={editingAddressId ? editingAddress.pinCode : newAddress.pinCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  if (editingAddressId) setEditingAddress({ ...editingAddress, pinCode: v });
                  else setNewAddress({ ...newAddress, pinCode: v });
                  setPinError('');
                }}
                aria-invalid={Boolean(pinError)}
                aria-describedby={pinError ? 'pin-error' : undefined}
                className={`p-3 rounded-lg border w-full focus:ring-teal-500 focus:border-teal-500 ${pinError ? 'border-red-400' : ''}`} />
              {pinError && <p id="pin-error" role="alert" className="text-red-500 text-xs mt-1">{pinError}</p>}
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowMap((v) => !v)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:text-teal-800"
            >
              <MapPin size={16} aria-hidden="true" />
              {showMap ? 'Hide map' : 'Pin location on map (optional)'}
            </button>
            {showMap && (
              <div className="mt-3">
                <LocationPicker
                  latitude={editingAddressId ? editingAddress.latitude : newAddress.latitude}
                  longitude={editingAddressId ? editingAddress.longitude : newAddress.longitude}
                  onPick={handlePin}
                  onAddressResolved={handleAddressResolved}
                />
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={addressSaving} className="bg-teal-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50">
              {addressSaving ? 'Saving...' : (editingAddressId ? 'Update Address' : 'Save Address')}
            </button>
            <button type="button" onClick={editingAddressId ? handleCloseEdit : resetForm} className="px-6 py-2 rounded-lg font-bold text-gray-600 bg-gray-200 hover:bg-gray-300">
              {editingAddressId ? 'Cancel' : 'Cancel'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4">
        {addressesLoading ? (
          <div className="space-y-4 animate-pulse">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="p-5 border border-gray-100 rounded-xl">
                <div className="h-4 w-40 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-56 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : addresses.length === 0 && !showAddressForm ? (
          <p className="text-gray-500">No addresses saved yet.</p>
        ) : null}
        {addresses.map((address) => (
          <div key={address._id} className="p-5 border border-gray-200 rounded-xl relative group hover:border-teal-500 transition-colors">
            <h3 className="font-bold text-gray-800 pr-16 break-words">{address.fullName} <span className="text-sm text-gray-500 font-normal ml-2">{address.phone}</span></h3>
            <p className="text-gray-600 text-sm mt-2">{address.street}, {address.city}, {address.state} - {address.pinCode}</p>
            {address.latitude != null && address.longitude != null && (
              <p className="text-teal-600 text-xs mt-2 inline-flex items-center gap-1">
                <MapPin size={12} aria-hidden="true" /> Pinned on map
              </p>
            )}
            <button onClick={() => onDeleteAddress(address._id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors p-2 bg-gray-50 rounded-full min-w-[44px] min-h-[44px] inline-flex items-center justify-center" aria-label={`Delete address for ${address.fullName}`}>
              <Trash2 size={18} aria-hidden="true" />
            </button>
            <button onClick={() => handleOpenEdit(address._id, address)} className="absolute top-4 right-14 text-gray-400 hover:text-teal-500 transition-colors p-2 bg-gray-50 rounded-full min-w-[44px] min-h-[44px] inline-flex items-center justify-center" aria-label={`Edit address for ${address.fullName}`}>
              <Edit size={18} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AddressManager;
