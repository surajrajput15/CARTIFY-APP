import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';

import HeroBanner from '../components/HeroBanner';
import ProductCard from '../components/ProductCard';

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 12 };
    if (selectedCategory !== 'all') params.category = selectedCategory;
    if (searchQuery) params.search = searchQuery;

      api.get('/api/products', { params })
      .then((response) => {
        const d = response.data;
        if (Array.isArray(d)) {
          setProducts(d);
          setTotal(d.length);
          setPages(1);
        } else {
          setProducts(d.products);
          setTotal(d.total);
          setPages(d.pages);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch products:", error);
        toast.error("Failed to load products");
      })
      .finally(() => setLoading(false));
  }, [page, selectedCategory, searchQuery]);

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
      <HeroBanner />

      <div className="mt-12 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-center">
        <div className="flex flex-wrap gap-3 justify-center">
          {['all', 'electronics', 'clothing', 'footwear', 'accessories', 'furniture', 'beauty'].map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-5 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
                selectedCategory === cat
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div id="products" className="mb-6 flex justify-between items-end scroll-mt-24">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {searchQuery ? `Search Results for "${searchQuery}"` : 'Trending Products ⚡'}
          </h2>
          <div className="w-20 h-1 bg-teal-500 rounded mt-2"></div>
        </div>
        {!loading && <span className="text-sm text-gray-500">{total} products found</span>}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
              <div className="bg-gray-200 h-48 rounded-xl mb-4"></div>
              <div className="bg-gray-200 h-4 w-3/4 rounded mb-2"></div>
              <div className="bg-gray-200 h-4 w-1/2 rounded"></div>
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>

          {pages > 1 && (
            <div className="mt-10 flex justify-center items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {[...Array(pages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-10 h-10 rounded-lg font-bold transition-colors ${
                    page === i + 1 ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="px-4 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
          <h3 className="text-2xl font-bold text-gray-400 mb-2">Sorry, no results found! 🕵️‍♂️</h3>
          <p className="text-gray-500">
            We couldn't find any matches for <span className="font-semibold text-gray-700">"{searchQuery}"</span>.
          </p>
          <p className="text-gray-500 mt-1">Try checking your spelling or using more general terms.</p>
        </div>
      )}
    </main>
  );
};

export default HomePage;
