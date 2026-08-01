import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createPaymentOrder, verifyPayment, createOrder } from '../services/ordersApi';
import { RAZORPAY_KEY } from '../config';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

export const useRazorpayPayment = ({ user, cart, clearCart, navigate, selectedAddress }) => {
  const [loading, setLoading] = useState(false);
  const razorpayLoadedRef = useRef(false);

  const loadRazorpayScript = useCallback(() => {
    return new Promise((resolve) => {
      if (razorpayLoadedRef.current) {
        resolve(true);
        return;
      }

      const existingScript = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
      if (existingScript) {
        razorpayLoadedRef.current = true;
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT_URL;
      script.id = 'razorpay-checkout-script';
      script.onload = () => {
        razorpayLoadedRef.current = true;
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  useEffect(() => {
    return () => {
      const script = document.getElementById('razorpay-checkout-script');
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      razorpayLoadedRef.current = false;
    };
  }, []);

  const handlePayment = useCallback(async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address!');
      return;
    }
    if (cart.length === 0) {
      toast.error('Your cart is empty!');
      return;
    }

    setLoading(true);

    const res = await loadRazorpayScript();
    if (!res) {
      toast.error('Razorpay SDK failed to load. Please check your internet connection.');
      setLoading(false);
      return;
    }

    try {
      const { data: order } = await createPaymentOrder(
        cart.map(item => ({
          productId: item._id || item.id,
          quantity: Math.floor(Number(item.quantity)) || 1
        }))
      );

      const options = {
        key: RAZORPAY_KEY,
        amount: order.amount,
        currency: "INR",
        name: "Cartify Premium",
        description: "Secure Checkout",
        order_id: order.id,
        handler: async function (response) {
          try {
            const verifyRes = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.data.success) {
              await createOrder({
                orderItems: cart,
                shippingAddress: selectedAddress,
                totalPrice: order.calculatedAmount,
                paymentInfo: { id: response.razorpay_payment_id, status: 'Paid' },
                status: 'Processing'
              });

              toast.success("Payment Successful! 🎉 Order Placed.");
              clearCart();
              navigate('/profile');
            }
          } catch (err) {
            console.error("Verification Error:", err.response?.data || err.message);
            toast.error(err.response?.data?.message || "Payment verification failed");
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
      toast.error(error.response?.data?.message || "Something went wrong with the payment gateway.");
    } finally {
      setLoading(false);
    }
  }, [user, cart, clearCart, navigate, selectedAddress, loadRazorpayScript]);

  return { loading, handlePayment };
};
