import { Link } from 'react-router-dom';
import { HelpCircle, Mail, Phone, Package, RotateCcw, Truck, User } from 'lucide-react';
import { SUPPORT_EMAIL, SHIPPING_CONFIG } from '../utils/constants';

const FAQS = [
  {
    q: 'How do I place an order?',
    a: 'Browse products, add items to your cart, then go to Checkout. Log in (or continue as guest), confirm a delivery address and complete payment with Razorpay. Once paid, your order appears under "My Orders" in your profile.',
  },
  {
    q: 'How do I track my order?',
    a: 'Open "My Orders" in your profile and tap Track on an order. The tracking page shows the live status (Pending → Processing → Shipped → Delivered) along with the assigned delivery partner.',
  },
  {
    q: 'What are the delivery timelines?',
    a: `Estimated delivery is ${SHIPPING_CONFIG.ESTIMATED_DELIVERY_DAYS} business days once the order ships.`,
  },
  {
    q: 'What is the shipping cost?',
    a: `Orders above ${'₹'}${SHIPPING_CONFIG.FREE_SHIPPING_THRESHOLD} ship free. Standard shipping is ${'₹'}${SHIPPING_CONFIG.STANDARD_SHIPPING_COST}.`,
  },
  {
    q: 'Can I cancel or return an order?',
    a: 'Pending orders can be cancelled from your profile. For delivered items, follow the Easy Returns flow — contact support and we will guide you through the return.',
  },
  {
    q: 'How do I save products I like?',
    a: 'Tap the heart icon on any product card or details page to save it to your Wishlist. You can view and manage it anytime from the Wishlist page.',
  },
  {
    q: 'How do I manage my delivery addresses?',
    a: 'Go to your Profile → Manage Addresses. You can add, edit or remove addresses used at checkout and when tracking deliveries.',
  },
  {
    q: 'How can I contact support?',
    a: `Email us at ${'support@cartify.com'} — our team is available 24/7 for any order or account issues.`,
  },
];

const FaqPage = () => {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <HelpCircle size={26} className="text-teal-600" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Help & Support</h1>
        </div>
        <p className="text-gray-500">Frequently asked questions and ways to reach us.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-10">
        <Link
          to="/profile?tab=orders"
          className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all min-h-[44px]"
        >
          <Package size={20} className="text-teal-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-gray-800 text-sm">Track my order</span>
        </Link>
        <Link
          to="/profile?tab=addresses"
          className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all min-h-[44px]"
        >
          <Truck size={20} className="text-teal-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-gray-800 text-sm">Manage addresses</span>
        </Link>
        <Link
          to="/wishlist"
          className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all min-h-[44px]"
        >
          <RotateCcw size={20} className="text-teal-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-gray-800 text-sm">My wishlist</span>
        </Link>
      </div>

      <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <User size={20} className="text-teal-600" aria-hidden="true" /> Frequently Asked Questions
      </h2>
      <div className="space-y-3">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
          >
            <summary className="flex items-center justify-between gap-3 px-5 py-4 font-bold text-gray-800 text-sm sm:text-base cursor-pointer list-none [&::-webkit-details-marker]:hidden min-h-[44px] hover:bg-gray-50 transition-colors">
              {f.q}
              <span className="text-teal-600 transition-transform group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p className="px-5 pb-4 text-gray-600 text-sm leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-12 bg-teal-600 rounded-2xl text-white px-6 py-8 text-center">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">Still need help?</h2>
        <p className="text-teal-50 text-sm mb-5">Our support team is available 24/7.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-2 bg-white text-teal-700 font-bold px-6 py-3 rounded-xl hover:bg-teal-50 transition-colors min-h-[44px]"
          >
            <Mail size={18} aria-hidden="true" /> {SUPPORT_EMAIL}
          </a>
          <a
            href={`tel:${SUPPORT_EMAIL.replace('@cartify.com', '1800-419-4242')}`}
            className="inline-flex items-center gap-2 bg-white/20 border border-white/40 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/30 transition-colors min-h-[44px]"
          >
            <Phone size={18} aria-hidden="true" /> 1800-419-4242
          </a>
        </div>
      </div>
    </main>
  );
};

export default FaqPage;