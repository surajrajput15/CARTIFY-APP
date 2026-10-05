import { Link } from 'react-router-dom';
import { ShoppingBag, Mail, Code2 } from 'lucide-react';
import { PACKAGE_VERSION } from '../version';
import { SUPPORT_EMAIL, AUTHOR_INFO } from '../utils/constants';

const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <h2 className="sr-only">Footer navigation and store details</h2>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <ShoppingBag size={24} className="text-teal-400" aria-hidden="true" />
              <span className="text-2xl font-extrabold text-white tracking-tight">
                Cartify<span className="text-teal-400">.</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-400">
              Your destination for top-quality electronics, fashion, accessories, and home essentials. Built with care for a fast, secure shopping experience.
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Shop</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">All Products</Link></li>
              <li><Link to="/cart" className="hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">My Cart</Link></li>
              <li><Link to="/profile" className="hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">My Account</Link></li>
              <li><Link to="/about" className="hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">About the Creator &amp; Stack</Link></li>
              <li><Link to="/login" className="hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">Sign In / Register</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 inline-flex items-center gap-1.5"
                >
                  <Mail size={14} aria-hidden="true" /> {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                <Link
                  to="/faq"
                  className="hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  Help &amp; FAQs
                </Link>
              </li>
              <li>
                <a
                  href={`${AUTHOR_INFO.repo}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  Report an Issue
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </li>
              <li>
                <a
                  href={AUTHOR_INFO.repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 inline-flex items-center gap-1.5"
                >
                  <Code2 size={14} aria-hidden="true" /> Source Code
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </li>
              <li>
                <a
                  href="https://razorpay.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  Payment Info
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Creator &amp; Connect</h3>
            <div className="mb-3 text-xs text-gray-400 leading-relaxed">
              <p className="font-semibold text-white text-sm">{AUTHOR_INFO.name}</p>
              <p className="text-teal-400 text-xs">{AUTHOR_INFO.jobTitle}</p>
            </div>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href={AUTHOR_INFO.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub profile"
                  className="flex items-center gap-2 hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <Code2 size={16} aria-hidden="true" /> GitHub (@surajrajput15)
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </li>
              <li>
                <a
                  href={AUTHOR_INFO.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn profile"
                  className="flex items-center gap-2 hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <span className="font-bold text-xs bg-teal-600 text-white px-1.5 py-0.5 rounded">in</span> LinkedIn Profile
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${AUTHOR_INFO.email}`}
                  className="flex items-center gap-2 hover:text-teal-400 transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 text-xs text-gray-400"
                >
                  <Mail size={14} aria-hidden="true" /> {AUTHOR_INFO.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-400">
          <p>&copy; {year} Cartify. Engineered by {AUTHOR_INFO.name}. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span>Made with care for high-speed shopping &amp; verified payments.</span>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span className="font-mono text-gray-400">v{PACKAGE_VERSION}</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
