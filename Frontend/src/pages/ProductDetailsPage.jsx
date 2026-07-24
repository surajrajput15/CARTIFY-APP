import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCart } from '../context/cartContext';
import { ShoppingCart, Star, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const ProductDetailsPage = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const { addToCart } = useCart();

  useEffect(() => {
    // API URL ko clean kar diya gaya hai
    api.get(`/api/products/${id}`)
      .then((response) => setProduct(response.data))
      .catch((error) => {
        console.error("Error fetching product:", error);
        toast.error("Failed to load product details");
      });
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
       <div className="text-2xl font-bold text-teal-600 animate-pulse">Loading product details... ⏳</div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6 mt-4">
      <Link to="/" className="inline-flex items-center text-teal-600 hover:text-teal-800 mb-6 font-medium transition-colors">
        <ArrowLeft size={20} className="mr-2" />
        Back to Products
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row">
        {/* Left Side: Product Image */}
        <div className="md:w-1/2 p-8 bg-gray-50 flex justify-center items-center">
          <img 
            src={product.image} 
            alt={product.title} 
            className="max-h-[400px] object-contain hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Right Side: Product Info */}
        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <span className="text-sm font-semibold text-teal-600 tracking-wider uppercase mb-2">
            {product.category}
          </span>
          
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            {product.title}
          </h1>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center bg-yellow-50 px-3 py-1 rounded-full border border-yellow-100">
              <Star className="text-yellow-400 fill-current mr-1" size={18} />
              <span className="font-bold text-gray-700">{product.rating?.rate}</span>
              <span className="text-gray-500 text-sm ml-1">({product.rating?.count} reviews)</span>
            </div>
          </div>
          
          <p className="text-gray-600 text-lg mb-8 leading-relaxed">
            {product.description}
          </p>
          
          <div className="mt-auto flex flex-col sm:flex-row items-center gap-6 pb-4 border-b border-gray-100 mb-6">
            <span className="text-4xl font-extrabold text-gray-900">
              ₹{product.price}
            </span>
          </div>

          <button 
            onClick={() => addToCart(product)}
            className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200 flex justify-center items-center gap-2"
          >
            <ShoppingCart size={24} />
            Add to Cart
          </button>
        </div>
      </div>
    </main>
  );
};

export default ProductDetailsPage;