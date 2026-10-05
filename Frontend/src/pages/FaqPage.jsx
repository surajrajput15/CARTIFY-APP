import { Link } from 'react-router-dom';
import { HelpCircle, Mail, Phone, Package, RotateCcw, Truck, User, ShieldCheck, Code2 } from 'lucide-react';
import { SUPPORT_EMAIL, SHIPPING_CONFIG } from '../utils/constants';
import useSeo from '../hooks/useSeo';

const FAQS = [
  {
    q: 'What is Cartify and who built it?',
    a: 'Cartify is a modern full-stack e-commerce web platform engineered by Suraj Bhan Pratap Singh, Full Stack Software Engineer. Built with React 19, Node.js, Express, MongoDB Atlas, and Razorpay, it offers secure purchasing, real-time live package tracking, and accessible customer portals.',
  },
  {
    q: 'How do I place an order on Cartify?',
    a: 'Browse products from our curated categories, add selected items to your cart, and proceed to Checkout. Select or add a delivery address, then complete payment through Razorpay using UPI, cards, or net banking. Your order immediately appears under "My Orders" with real-time status updates.',
  },
  {
    q: 'How does real-time order tracking work?',
    a: 'Open "My Orders" in your profile and click "Track" on your order. The live tracking system connects to real-time status transitions (Pending → Processing → Shipped → Delivered) along with assigned delivery agent details and interactive map coordinates.',
  },
  {
    q: 'What are the delivery timelines and shipping costs?',
    a: `Standard delivery takes ${SHIPPING_CONFIG.ESTIMATED_DELIVERY_DAYS} business days once dispatched from our fulfillment warehouse. Delivery is completely free across all orders with zero hidden packaging or handling charges.`,
  },
  {
    q: 'How are online payments verified and secured?',
    a: 'All transactions use Razorpay payment gateway integration with server-side price calculation and cryptographic HMAC-SHA256 signature verification. The backend recalculates order sums from database records to prevent client-side price tampering.',
  },
  {
    q: 'Can I cancel or return an order?',
    a: 'Pending orders can be instantly cancelled directly from your Profile orders tab. For delivered packages, reach out to our 24/7 customer support via email to initiate an easy return and refund authorization.',
  },
  {
    q: 'How do I save items to my Wishlist?',
    a: 'Click the heart icon on any product card or details view to save it to your personal Wishlist. Your wishlist items are synchronized across sessions and can be moved directly to the cart whenever you are ready.',
  },
  {
    q: 'How can I contact customer support?',
    a: `You can reach our dedicated support team at ${SUPPORT_EMAIL} or call toll-free at 1800-419-4242. Our engineering and support team operates 24/7 for order, payment, or account assistance.`,
  },
];

const FaqPage = () => {
  // AEO (Answer Engine Optimization) FAQ Schema
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  useSeo({
    title: 'Help & FAQs — Customer Support & Delivery Guide',
    description: 'Find instant answers about Cartify ordering, 3-5 day delivery, Razorpay payment security, returns, and full-stack MERN engineering support.',
    canonical: '/faq',
    schema: faqSchema,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <HelpCircle size={26} className="text-teal-600" aria-hidden="true" />
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Help &amp; Support</h1>
        </div>
        <p className="text-gray-500">Frequently asked questions, delivery timelines, and direct support assistance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 mb-10">
        <Link
          to="/profile?tab=orders"
          className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all min-h-[44px]"
        >
          <Package size={20} className="text-teal-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-gray-800 text-sm">Track order</span>
        </Link>
        <Link
          to="/profile?tab=addresses"
          className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all min-h-[44px]"
        >
          <Truck size={20} className="text-teal-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-gray-800 text-sm">Addresses</span>
        </Link>
        <Link
          to="/wishlist"
          className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all min-h-[44px]"
        >
          <RotateCcw size={20} className="text-teal-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-gray-800 text-sm">Wishlist</span>
        </Link>
        <Link
          to="/about"
          className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all min-h-[44px]"
        >
          <Code2 size={20} className="text-teal-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-gray-800 text-sm">About Creator</span>
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
              <span>{f.q}</span>
              <span className="text-teal-600 transition-transform group-open:rotate-45 font-mono text-lg" aria-hidden="true">+</span>
            </summary>
            <div className="px-5 pb-4 text-gray-600 text-sm leading-relaxed border-t border-gray-50 pt-3">
              <p>{f.a}</p>
            </div>
          </details>
        ))}
      </div>

      <div className="mt-12 bg-teal-600 rounded-2xl text-white px-6 py-8 text-center shadow-lg">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-3">
          <ShieldCheck size={24} className="text-teal-200" aria-hidden="true" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold mb-2">Still need help?</h2>
        <p className="text-teal-50 text-sm mb-5">Our support team and engineering lead are available 24/7.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-2 bg-white text-teal-700 font-bold px-6 py-3 rounded-xl hover:bg-teal-50 transition-colors min-h-[44px]"
          >
            <Mail size={18} aria-hidden="true" /> {SUPPORT_EMAIL}
          </a>
          <a
            href="tel:1800-419-4242"
            className="inline-flex items-center gap-2 bg-white/20 border border-white/40 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/30 transition-colors min-h-[44px]"
          >
            <Phone size={18} aria-hidden="true" /> 1800-419-4242
          </a>
        </div>
      </div>
    </div>
  );
};

export default FaqPage;