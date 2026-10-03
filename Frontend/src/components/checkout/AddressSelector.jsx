import { MapPin, CheckCircle, Plus, AlertCircle, AlertTriangle } from 'lucide-react';
import { EmptyProductsIllustration } from '../illustrations/EmptyStateIllustrations';
import Button from '../ui/Button';
import { normalizeIndianPhone, normalizePinCode } from '../../utils/normalize';

const AddressSelector = ({ addresses, loading, error, selectedAddress, onSelect, onGoToProfile, onRetry }) => {
  const isSelectedPhoneValid = selectedAddress ? Boolean(normalizeIndianPhone(selectedAddress.phone)) : true;
  const isSelectedPinValid = selectedAddress ? Boolean(normalizePinCode(selectedAddress.pinCode)) : true;

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6" aria-labelledby="address-selector-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="address-selector-heading" className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
          <MapPin className="text-teal-600" aria-hidden="true" /> Select Delivery Address
        </h2>
        {addresses.length > 0 && onGoToProfile && (
          <button
            type="button"
            onClick={onGoToProfile}
            className="text-xs sm:text-sm font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 min-h-[36px]"
          >
            <Plus size={15} aria-hidden="true" /> Manage in Profile
          </button>
        )}
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
          <p className="text-gray-600 mb-4 text-sm sm:text-base">You don't have any saved addresses yet.</p>
          <Button
            onClick={onGoToProfile}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-colors min-h-[44px]"
          >
            <Plus size={18} aria-hidden="true" /> Add Address in Profile
          </Button>
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
    </section>
  );
};

export default AddressSelector;
