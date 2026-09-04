import { Link } from 'react-router-dom';
import { ShoppingBag, Mail, Globe, Code2 } from 'lucide-react';
import { PACKAGE_VERSION } from '../version';

const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
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
              <li><Link to="/" className="hover:text-teal-400 transition-colors">All Products</Link></li>
              <li><Link to="/cart" className="hover:text-teal-400 transition-colors">My Cart</Link></li>
              <li><Link to="/profile" className="hover:text-teal-400 transition-colors">My Account</Link></li>
              <li><Link to="/login" className="hover:text-teal-400 transition-colors">Sign In / Register</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="mailto:support@cartify.com"
                  className="hover:text-teal-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <Mail size={14} aria-hidden="true" /> support@cartify.com
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/surajrajput15/CARTIFY-APP/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-teal-400 transition-colors"
                >
                  Report an Issue
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/surajrajput15/CARTIFY-APP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-teal-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <Code2 size={14} aria-hidden="true" /> Source Code
                </a>
              </li>
              <li>
                <a
                  href="https://razorpay.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-teal-400 transition-colors"
                >
                  Payment Info
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Connect</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="https://github.com/surajrajput15"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub profile"
                  className="flex items-center gap-2 hover:text-teal-400 transition-colors"
                >
                  <Code2 size={16} aria-hidden="true" /> GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter"
                  className="flex items-center gap-2 hover:text-teal-400 transition-colors"
                >
                  <Globe size={16} aria-hidden="true" /> Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="flex items-center gap-2 hover:text-teal-400 transition-colors"
                >
                  <Globe size={16} aria-hidden="true" /> LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-500">
          <p>&copy; {year} Cartify. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span>Made with care for a better shopping experience.</span>
            <span className="hidden sm:inline" aria-hidden="true">·</span>
            <span className="font-mono text-gray-400">v{PACKAGE_VERSION}</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
