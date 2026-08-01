import { MapPin, CheckCircle } from 'lucide-react';

const AddressSelector = ({ addresses, loading, selectedAddress, onSelect, onGoToProfile }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
      <MapPin className="text-teal-600" aria-hidden="true" /> Select Delivery Address
    </h2>

    {loading ? (
      <div className="space-y-4 animate-pulse">
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
    ) : addresses.length === 0 ? (
      <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-200">
        <p className="text-gray-600 mb-4">You don't have any saved addresses.</p>
        <button onClick={onGoToProfile} className="px-6 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700">
          Add Address in Profile
        </button>
      </div>
    ) : (
      <div className="space-y-4">
        {addresses.map((addr) => (
          <label key={addr._id} className={`flex items-start p-4 border rounded-xl cursor-pointer transition-colors ${selectedAddress?._id === addr._id ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300'}`}>
            <input
              type="radio"
              name="address"
              className="mt-1 w-4 h-4 text-teal-600 focus:ring-teal-500"
              checked={selectedAddress?._id === addr._id}
              onChange={() => onSelect(addr)}
              aria-label={`Deliver to ${addr.fullName}, ${addr.street}, ${addr.city}`}
            />
            <div className="ml-3 flex-1">
              <p className="font-bold text-gray-800">{addr.fullName} <span className="font-normal text-gray-500 ml-2">{addr.phone}</span></p>
              <p className="text-sm text-gray-600 mt-1">{addr.street}, {addr.city}, {addr.state} - {addr.pinCode}</p>
            </div>
            {selectedAddress?._id === addr._id && <CheckCircle className="text-teal-600" size={20} aria-hidden="true" />}
          </label>
        ))}
      </div>
    )}
  </div>
);

export default AddressSelector;
