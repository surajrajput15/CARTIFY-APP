import { MapPin, CheckCircle, Plus } from 'lucide-react';
import { EmptyProductsIllustration } from '../illustrations/EmptyStateIllustrations';

const AddressSelector = ({ addresses, loading, selectedAddress, onSelect, onGoToProfile }) => (
  <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6" aria-labelledby="address-selector-heading">
    <h2 id="address-selector-heading" className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
      <MapPin className="text-teal-600" aria-hidden="true" /> Select Delivery Address
    </h2>

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
    ) : addresses.length === 0 ? (
      <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-xl border border-gray-200 px-4">
        <EmptyStateIllustration className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 opacity-80" />
        <p className="text-gray-600 mb-4 text-sm sm:text-base">You don't have any saved addresses yet.</p>
        <button
          onClick={onGoToProfile}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 transition-colors min-h-[44px]"
        >
          <Plus size={18} aria-hidden="true" /> Add Address in Profile
        </button>
      </div>
    ) : (
      <div className="space-y-3" role="radiogroup" aria-labelledby="address-selector-heading">
        {addresses.map((addr) => {
          const isSelected = selectedAddress?._id === addr._id;
          return (
            <label
              key={addr._id}
              className={`flex items-start p-3 sm:p-4 border rounded-xl cursor-pointer transition-colors min-h-[64px] ${
                isSelected ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300'
              }`}
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
              </div>
              {isSelected && <CheckCircle className="text-teal-600 flex-shrink-0" size={20} aria-hidden="true" />}
            </label>
          );
        })}
      </div>
    )}
  </section>
);

export default AddressSelector;
