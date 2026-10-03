import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { createPaymentOrder, verifyPayment } from '../services/ordersApi';
import { RAZORPAY_KEY } from '../config';
import { RAZORPAY_DISPLAY } from '../utils/constants';
import { formatPrice } from '../utils/format';
import { handleApiError } from '../utils/apiError';
import { logError, logDebug } from '../utils/logger';
import { normalizeIndianPhone, normalizePinCode } from '../utils/normalize';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

export const useRazorpayPayment = ({ user, cart, clearCart, navigate, selectedAddress, couponCode, clearCoupon }) => {
  const [loading, setLoading] = useState(false);
  // Inline payment-error for checkout (role=alert region) — transient toasts
  // scroll away, so a failed/cancelled payment must also persist on the page.
  const [paymentError, setPaymentError] = useState(null);
  // F-09: synchronous re-entrancy guard. `loading` state updates are async, so
  // a fast double-click could reach createPaymentOrder twice before the button
  // disables. Set/cleared in lockstep with setLoading around the async work.
  const loadingRef = useRef(false);
  const razorpayLoadedRef = useRef(false);
  // Ensures EXACTLY ONE success confirmation even if the Razorpay success
  // callback fires more than once (e.g. replayed / duplicated handler events).
  // Set before navigation so it is never lost when the checkout page unmounts
  // into the lazy /profile route; the global <Toaster> keeps it visible.
  const successNotifiedRef = useRef(false);

  // Open Razorpay modal instance, if any — closed on unmount so a stray
  // modal never outlives the checkout page.
  const paymentObjectRef = useRef(null);

  logDebug('[Razorpay] useRazorpayPayment initiated', { user: user?.email, cartLength: cart.length, hasSelectedAddress: !!selectedAddress, hasRazorpayKey: !!RAZORPAY_KEY });

  const loadRazorpayScript = useCallback(() => {
    return new Promise((resolve) => {
      if (razorpayLoadedRef.current || window.Razorpay) {
        razorpayLoadedRef.current = true;
        resolve(true);
        return;
      }

      const existingScript = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
      if (existingScript) {
        // A previous mount already injected the tag: reuse it instead of
        // downloading twice. Wait for its load event when still pending.
        if (existingScript.dataset.loaded === 'true') {
          razorpayLoadedRef.current = true;
          resolve(true);
          return;
        }
        existingScript.addEventListener('load', () => {
          existingScript.dataset.loaded = 'true';
          razorpayLoadedRef.current = true;
          resolve(true);
        }, { once: true });
        existingScript.addEventListener('error', () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT_URL;
      script.id = 'razorpay-checkout-script';
      script.onload = () => {
        script.dataset.loaded = 'true';
        razorpayLoadedRef.current = true;
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  useEffect(() => {
    // The checkout script tag is intentionally kept across mounts (cached,
    // reused via loadRazorpayScript) — only a live modal is torn down here.
    return () => {
      try {
        paymentObjectRef.current?.close?.();
      } catch {
        // Modal already closed — nothing to do.
      }
      paymentObjectRef.current = null;
    };
  }, []);

  const handlePayment = useCallback(async () => {
    logDebug('[Razorpay] handlePayment called', { selectedAddress: !!selectedAddress, cartLength: cart.length });
    if (loadingRef.current) return;
    setPaymentError(null);
    if (!selectedAddress) {
      toast.error('Please select a delivery address!');
      setPaymentError('Select a delivery address before paying.');
      return;
    }

    const cleanPhone = selectedAddress.phone ? normalizeIndianPhone(selectedAddress.phone) : null;
    if (selectedAddress.phone && !cleanPhone) {
      const msg = `Selected address phone number "${selectedAddress.phone}" is invalid. Please update it to a valid 10-digit Indian number starting with 6, 7, 8 or 9.`;
      toast.error(msg);
      setPaymentError(msg);
      return;
    }

    const cleanPin = selectedAddress.pinCode ? normalizePinCode(selectedAddress.pinCode) : null;
    if (selectedAddress.pinCode && !cleanPin) {
      const msg = `Selected address PIN code "${selectedAddress.pinCode}" is invalid. PIN code must be exactly 6 digits.`;
      toast.error(msg);
      setPaymentError(msg);
      return;
    }

    if (cart.length === 0) {
      toast.error('Your cart is empty!');
      setPaymentError('Your cart is empty — add items before paying.');
      return;
    }

    // Razorpay key is required before any payment is attempted. There is no fallback
    // key (a test key would silently never process a real payment). Fails loudly here
    // with a clear user-facing message instead of opening a broken checkout modal.
    if (!RAZORPAY_KEY) {
      toast.error('Payment is not configured. Please contact support to enable checkout.');
      setPaymentError('Payments are not configured yet. Please contact support to enable checkout.');
      setLoading(false);
      return;
    }

    logDebug('[Razorpay] RAZORPAY_KEY present, loading SDK...');
    loadingRef.current = true;
    setLoading(true);

    const res = await loadRazorpayScript();
    logDebug('[Razorpay] loadRazorpayScript result:', res);
    if (!res) {
      toast.error('Razorpay SDK failed to load. Please check your internet connection.');
      setPaymentError('The payment window could not load. Check your internet connection and try again. No amount has been charged.');
      loadingRef.current = false;
      setLoading(false);
      return;
    }

    try {
      const canonicalAddress = {
        ...selectedAddress,
        ...(cleanPhone ? { phone: cleanPhone } : {}),
        ...(cleanPin ? { pinCode: cleanPin } : {}),
      };

      const { data } = await createPaymentOrder(
        cart.map(item => ({
          productId: item._id || item.id,
          quantity: Math.floor(Number(item.quantity)) || 1,
          ...(item.variantKey ? { variantKey: item.variantKey } : {})
        })),
        canonicalAddress,
        couponCode || undefined
      );

      logDebug('[Razorpay] createPaymentOrder response:', data);
      
      // Free-order shortcut (100% discount): backend already created a Paid order.
      if (data.freeOrder) {
        toast.success('Order placed successfully! 🎉 (100% coupon applied)');
        clearCart();
        if (clearCoupon) clearCoupon();
        const confirmedOrderId = data.orderId || data.savedOrder?._id;
        navigate(confirmedOrderId ? `/order-confirmation/${confirmedOrderId}` : '/profile?tab=orders');
        return;
      }

      const order = data.order;

      // The cart stores a price snapshot, but the server always recomputes prices from the
      // live catalog. If a product price changed since it was added, warn the user so the
      // final charge never silently surprises them. Skip when a coupon is active
      // because calculatedAmount is post-discount and would false-positive.
      const clientTotal = cart.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
        0
      );
      if (
        !couponCode &&
        typeof order.calculatedAmount === 'number' &&
        Math.abs(order.calculatedAmount - clientTotal) > 0.01
      ) {
        toast.warn(
          `Order total refreshed to ${formatPrice(order.calculatedAmount)} (prices were updated since you added items).`
        );
      }

      // Guards the modal-ondismiss handler so it only reports a user-initiated
      // cancellation. Without this, the modal ALSO dismisses after a successful
      // payment or a payment.failed event, producing a confusing duplicate toast.
      let paymentResultHandled = false;

      const options = {
        key: RAZORPAY_KEY,
        amount: order.amount,
        currency: RAZORPAY_DISPLAY.currency,
        name: RAZORPAY_DISPLAY.name,
        description: RAZORPAY_DISPLAY.description,
        order_id: order.id,
        handler: async function (response) {
          paymentResultHandled = true;
          paymentObjectRef.current = null;
          try {
            const verifyRes = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.data.success) {
              if (!successNotifiedRef.current) {
                successNotifiedRef.current = true;
                toast.success("Payment Successful! 🎉 Order Placed.");
                clearCart();
                if (clearCoupon) clearCoupon();
                const confirmedOrderId = verifyRes.data.order?._id || order.id;
                navigate(confirmedOrderId ? `/order-confirmation/${confirmedOrderId}` : '/profile?tab=orders');
              }
            } else {
              toast.error(verifyRes.data.message || "Payment could not be verified");
              setPaymentError('Your payment has not been confirmed. If an amount was debited, it will be refunded automatically.');
            }
          } catch (err) {
            logError("Verification Error:", err.response?.data || err.message);
            toast.error(handleApiError(err, "Payment verification failed"));
            setPaymentError('Your payment has not been confirmed. If an amount was debited, it will be refunded automatically.');
          }
        },
        modal: {
          ondismiss: function () {
            if (paymentResultHandled) return;
            paymentObjectRef.current = null;
            toast.error("Payment cancelled. You can retry whenever you're ready.");
            setPaymentError('Payment cancelled. No amount has been charged — you can retry whenever you are ready.');
          },
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: cleanPhone || selectedAddress.phone
        },
        theme: {
          color: RAZORPAY_DISPLAY.themeColor
        }
      };

      logDebug('[Razorpay] Creating Razorpay modal with options:', { key: RAZORPAY_KEY, hasAmount: !!order.amount, hasOrderId: !!order.id });
      
      const paymentObject = new window.Razorpay(options);
      paymentObjectRef.current = paymentObject;
      logDebug('[Razorpay] Razorpay modal created, about to open...');
      paymentObject.open();

    } catch (error) {
      logError("Payment setup failed", error);
      const apiMsg = error?.response?.data?.message || '';
      if (apiMsg.includes('Phone must be a valid 10-digit Indian number')) {
        const msg = `Selected address phone (${selectedAddress.phone || ''}) is not a valid 10-digit Indian number. Please edit your address to fix it.`;
        toast.error(msg);
        setPaymentError(msg);
      } else {
        const message = handleApiError(error, "Something went wrong with the payment gateway.");
        toast.error(message);
        setPaymentError(`${message} No amount has been charged.`);
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [user, cart, clearCart, navigate, selectedAddress, couponCode, clearCoupon, loadRazorpayScript]);

  return { loading, handlePayment, paymentError };
};
