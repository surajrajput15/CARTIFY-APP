import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/authContext';
import { useCart } from '../context/cartContext'; 
import { useNavigate } from 'react-router-dom';
import { MapPin, CreditCard, ShieldCheck, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { RAZORPAY_KEY } from '../config';

const CheckoutPage = () => {
  const { user } = useAuth();
  const { cart, clearCart } = useCart(); // 👈 cartTotal yahan se hata diya
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingAddresses, setFetchingAddresses] = useState(true);

  // 🚀 NAYA LOGIC: Khud total calculate karo
  const calculatedTotal = cart.reduce((total, item) => total + (item.price * (item.quantity || 1)), 0);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    const fetchAddresses = async () => {
      try {
        const response = await api.get(`/api/addresses/${user.id}`);
        setAddresses(response.data);
        if (response.data.length > 0) {
          setSelectedAddress(response.data[0]); 
        }
      } catch (error) {
        console.error("Failed to fetch addresses", error);
        toast.error("Failed to load addresses");
      } finally {
        setFetchingAddresses(false);
      }
    };
    fetchAddresses();
  }, [user, navigate]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    if (!selectedAddress) {
      alert("Please select a delivery address!");
      return;
    }
    if (cart.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    setLoading(true);

    const res = await loadRazorpayScript();
    if (!res) {
      alert("Razorpay SDK failed to load. Are you online?");
      setLoading(false);
      return;
    }

    try {
      const { data: order } = await api.post('/api/payment/create-order', {
        amount: calculatedTotal
      });

      const options = {
        key: RAZORPAY_KEY,
        amount: order.amount,
        currency: "INR",
        name: "Cartify Premium",
        description: "Secure Checkout",
        order_id: order.id,
        handler: async function (response) {
          try {
            const verifyRes = await api.post('/api/payment/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.data.success) {
              await api.post('/api/orders/add', {
                orderItems: cart,
                shippingAddress: selectedAddress,
                totalPrice: calculatedTotal,
                paymentInfo: { id: response.razorpay_payment_id, status: 'Paid' },
                status: 'Processing'
              });

              alert("Payment Successful! 🎉 Order Placed.");
              clearCart(); 
              navigate('/profile'); 
            }
          } catch (err) {
   console.error("Asali Error:", err.response?.data || err.message);
   alert("Error: " + (err.response?.data?.message || err.message));
}
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: selectedAddress.phone
        },
        theme: {
          color: "#0d9488" 
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();

    } catch (error) {
      console.error("Payment setup failed", error);
      alert("Something went wrong with the payment gateway.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8 flex items-center gap-2">
        <ShieldCheck className="text-teal-600" size={32} /> Secure Checkout
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <MapPin className="text-teal-600" /> Select Delivery Address
            </h2>
            
            {fetchingAddresses ? (
              <p className="text-gray-500 animate-pulse">Loading saved addresses...</p>
            ) : addresses.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-gray-600 mb-4">You don't have any saved addresses.</p>
                <button onClick={() => navigate('/profile')} className="px-6 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700">
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
                      onChange={() => setSelectedAddress(addr)}
                    />
                    <div className="ml-3 flex-1">
                      <p className="font-bold text-gray-800">{addr.fullName} <span className="font-normal text-gray-500 ml-2">{addr.phone}</span></p>
                      <p className="text-sm text-gray-600 mt-1">{addr.street}, {addr.city}, {addr.state} - {addr.pinCode}</p>
                    </div>
                    {selectedAddress?._id === addr._id && <CheckCircle className="text-teal-600" size={20} />}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-fit sticky top-24">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Order Summary</h2>
          
          <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2">
            {cart.map((item, index) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <span className="text-gray-600 truncate w-48">{item.title} (x{item.quantity || 1})</span>
                <span className="font-bold text-gray-800">₹{item.price * (item.quantity || 1)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-4 mb-6">
            <div className="flex justify-between items-center text-lg font-extrabold text-gray-900">
              <span>Total Amount</span>
              {/* 👈 Niche total theek kiya gaya hai */}
              <span>₹{calculatedTotal}</span> 
            </div>
          </div>

          <button 
            onClick={handlePayment} 
            disabled={loading || !selectedAddress || cart.length === 0}
            className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-600 transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : (
              <>
                {/* 👈 Button par bhi total theek kiya gaya hai */}
                <CreditCard size={20} /> Pay ₹{calculatedTotal} Now
              </>
            )}
          </button>
          
          <p className="text-xs text-center text-gray-500 mt-4 flex items-center justify-center gap-1">
            <ShieldCheck size={14} /> 100% Secure Payments by Razorpay
          </p>
        </div>

      </div>
    </div>
  );
};

export default CheckoutPage;