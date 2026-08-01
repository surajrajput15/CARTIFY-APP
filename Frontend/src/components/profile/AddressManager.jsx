import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_ADDRESS = { fullName: '', phone: '', street: '', city: '', state: '', pinCode: '' };

const isValidIndianPhone = (phone) => /^[6-9]\d{9}$/.test(phone);

const AddressManager = ({ addresses, addressesLoading, onSaveAddress, onDeleteAddress }) => {
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);

  const handleSave = async (e) => {
    e.preventDefault();
    setPhoneError('');
    if (!isValidIndianPhone(newAddress.phone)) {
      setPhoneError('Enter a valid 10-digit Indian phone number starting with 6, 7, 8, or 9');
      return;
    }
    setAddressSaving(true);
    try {
      await onSaveAddress(newAddress);
      setShowAddressForm(false);
      setNewAddress(EMPTY_ADDRESS);
    } catch {
      toast.error("Failed to save address");
    } finally {
      setAddressSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fade-in-up">
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
        <h2 className="text-xl font-bold text-gray-800">Manage Addresses</h2>
        {!showAddressForm && (
          <button onClick={() => setShowAddressForm(true)} className="flex items-center gap-1 text-sm font-bold text-teal-600 hover:text-teal-700">
            <Plus size={16} aria-hidden="true" /> Add New
          </button>
        )}
      </div>

      {showAddressForm && (
        <form onSubmit={handleSave} className="mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
          <h3 className="font-bold text-gray-800 mb-4">Add a new address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Full Name" required value={newAddress.fullName} onChange={(e) => setNewAddress({...newAddress, fullName: e.target.value})} className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500" />
            <div>
              <input type="text" placeholder="Phone Number" required value={newAddress.phone} onChange={(e) => { setNewAddress({...newAddress, phone: e.target.value}); setPhoneError(''); }} className={`p-3 rounded-lg border w-full focus:ring-teal-500 focus:border-teal-500 ${phoneError ? 'border-red-400' : ''}`} />
              {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
            </div>
            <input type="text" placeholder="Street / Flat / Area" required value={newAddress.street} onChange={(e) => setNewAddress({...newAddress, street: e.target.value})} className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500 md:col-span-2" />
            <input type="text" placeholder="City" required value={newAddress.city} onChange={(e) => setNewAddress({...newAddress, city: e.target.value})} className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500" />
            <input type="text" placeholder="State" required value={newAddress.state} onChange={(e) => setNewAddress({...newAddress, state: e.target.value})} className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500" />
            <input type="text" placeholder="PIN Code" required value={newAddress.pinCode} onChange={(e) => setNewAddress({...newAddress, pinCode: e.target.value})} className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500" />
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={addressSaving} className="bg-teal-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50">
              {addressSaving ? 'Saving...' : 'Save Address'}
            </button>
            <button type="button" onClick={() => setShowAddressForm(false)} className="px-6 py-2 rounded-lg font-bold text-gray-600 bg-gray-200 hover:bg-gray-300">
              Cancel
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
            <h3 className="font-bold text-gray-800">{address.fullName} <span className="text-sm text-gray-500 font-normal ml-2">{address.phone}</span></h3>
            <p className="text-gray-600 text-sm mt-2">{address.street}, {address.city}, {address.state} - {address.pinCode}</p>
            <button onClick={() => onDeleteAddress(address._id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors p-2 bg-gray-50 rounded-full" aria-label={`Delete address for ${address.fullName}`}>
              <Trash2 size={18} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AddressManager;
