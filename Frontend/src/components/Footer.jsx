import { Link } from 'react-router-dom';
import { ShoppingBag, Mail, Globe } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <ShoppingBag size={24} className="text-teal-400" aria-hidden="true" />
              <span className="text-2xl font-extrabold text-white tracking-tight">Cartify.</span>
            </Link>
            <p className="text-sm leading-relaxed">
              Your premium destination for top-quality electronics, fashion, accessories, and more.
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-teal-400 transition-colors">Home</Link></li>
              <li><Link to="/cart" className="hover:text-teal-400 transition-colors">Cart</Link></li>
              <li><Link to="/profile" className="hover:text-teal-400 transition-colors">My Account</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-4">Support</h3>
            <ul className="space-y-2 text-sm">
              <li><span className="hover:text-teal-400 transition-colors cursor-pointer">Help Center</span></li>
              <li><span className="hover:text-teal-400 transition-colors cursor-pointer">Shipping Info</span></li>
              <li><span className="hover:text-teal-400 transition-colors cursor-pointer">Returns</span></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-4">Connect</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="mailto:support@cartify.com" className="flex items-center gap-2 hover:text-teal-400 transition-colors">
                  <Mail size={16} aria-hidden="true" /> support@cartify.com
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center gap-2 hover:text-teal-400 transition-colors">
                  <Globe size={16} aria-hidden="true" /> Twitter
                </a>
              </li>
              <li>
                <a href="#" className="flex items-center gap-2 hover:text-teal-400 transition-colors">
                  <Globe size={16} aria-hidden="true" /> GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <p>&copy; {new Date().getFullYear()} Cartify. All rights reserved.</p>
          <p>Made with care for the best shopping experience.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
