import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/authContext';
import { useNavigate } from 'react-router-dom';
import { Package, User, MapPin, Settings, LogOut, Plus, Lock, Calendar, CreditCard, Loader2, Edit2, Check, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';

const ProfilePage = () => {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('profile'); 
  
  // 📦 Orders State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // 👤 Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [updateLoading, setUpdateLoading] = useState(false);

  // 📍 Addresses State
  const [addresses, setAddresses] = useState([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [newAddress, setNewAddress] = useState({
    fullName: '', phone: '', street: '', city: '', state: '', pinCode: ''
  });

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  // Fetch Orders & Addresses dynamically
  useEffect(() => {
    if (activeTab === 'orders' && user) {
      fetchOrders();
    }
    if (activeTab === 'addresses' && user) {
      fetchAddresses();
    }
  }, [activeTab, user]);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await api.get(`/api/orders/myorders/${user.id}`);
      setOrders(response.data);
    } catch (error) {
      console.error("Failed to fetch orders", error);
      toast.error("Failed to load orders");
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchAddresses = async () => {
    try {
      const response = await api.get(`/api/addresses/${user.id}`);
      setAddresses(response.data);
    } catch (error) {
      console.error("Failed to fetch addresses", error);
      toast.error("Failed to load addresses");
    }
  };

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim()) return;
    setUpdateLoading(true);
    try {
      const response = await api.put(`/api/auth/update/${user.id}`, { name: editName });
      login(response.data.user); 
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile", error);
      toast.error("Failed to update profile");
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure you want to permanently delete your account?");
    if (confirmDelete) {
      try {
        await api.delete(`/api/auth/delete/${user.id}`);
        logout();
        navigate('/');
      } catch (error) {
        console.error("Failed to delete account", error);
        toast.error("Failed to delete account");
      }
    }
  };

  // 🚀 SAVE NEW ADDRESS LOGIC
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setAddressLoading(true);
    try {
      await api.post('/api/addresses/add', { ...newAddress });
      setShowAddressForm(false);
      setNewAddress({ fullName: '', phone: '', street: '', city: '', state: '', pinCode: '' });
      fetchAddresses(); // Refresh the list
    } catch (error) {
      console.error("Error saving address", error);
      toast.error("Failed to save address");
    } finally {
      setAddressLoading(false);
    }
  };

  // 🚀 DELETE ADDRESS LOGIC
  const handleDeleteAddress = async (id) => {
    if(window.confirm("Delete this address?")) {
      try {
        await api.delete(`/api/addresses/${id}`);
        fetchAddresses(); // Refresh the list
      } catch (error) {
        console.error("Error deleting address", error);
        toast.error("Failed to delete address");
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">My Account</h1>
      
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Left Sidebar */}
        <div className="w-full md:w-1/4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sticky top-24">
            <div className="flex items-center space-x-4 mb-6 p-2">
              <div className="h-12 w-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center font-bold text-xl">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-gray-500">Hello,</p>
                <p className="font-bold text-gray-800 truncate w-32" title={user.name}>{user.name.split(' ')[0]}</p>
              </div>
            </div>
            
            <nav className="space-y-2">
              <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === 'profile' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50 hover:text-teal-600'}`}>
                <User size={20} /><span>Profile Information</span>
              </button>
              <button onClick={() => setActiveTab('orders')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === 'orders' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50 hover:text-teal-600'}`}>
                <Package size={20} /><span>My Orders</span>
              </button>
              <button onClick={() => setActiveTab('addresses')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === 'addresses' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50 hover:text-teal-600'}`}>
                <MapPin size={20} /><span>Manage Addresses</span>
              </button>
              <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === 'settings' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50 hover:text-teal-600'}`}>
                <Settings size={20} /><span>Account Settings</span>
              </button>
              
              <hr className="my-2 border-gray-100" />
              <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg font-medium transition-colors">
                <LogOut size={20} /><span>Logout</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="w-full md:w-3/4 space-y-6">
          
          {/* 1. Profile Information Tab */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fade-in-up">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Personal Information</h2>
                {!isEditing ? (
                  <button onClick={() => setIsEditing(true)} className="flex items-center gap-1 text-sm font-bold text-teal-600 hover:text-teal-700">
                    <Edit2 size={16} /> Edit Profile
                  </button>
                ) : (
                  <button onClick={() => setIsEditing(false)} className="flex items-center gap-1 text-sm font-bold text-gray-500 hover:text-gray-700">
                    <X size={16} /> Cancel
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">Full Name</label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium" />
                      <button onClick={handleUpdateProfile} disabled={updateLoading} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 flex items-center justify-center min-w-[48px]">
                        {updateLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-900 font-semibold bg-gray-50 p-3 rounded-lg border border-gray-200">{user.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">Email Address (Cannot be changed)</label>
                  <p className="text-gray-500 font-medium bg-gray-100 p-3 rounded-lg border border-gray-200 cursor-not-allowed">{user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* 2. My Orders Tab (Code is ready for real data) */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fade-in-up">
              <h2 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-4">Recent Orders</h2>
              {loadingOrders ? (
                <p>Loading orders...</p>
              ) : orders.length === 0 ? (
                <p className="text-gray-500">Your order history will appear here once you make a purchase.</p>
              ) : (
                <div className="space-y-4">
                  {orders.map(order => (
                     <div key={order._id} className="p-4 border rounded-lg bg-gray-50">
                        <p className="font-bold">Order ID: #{order._id.slice(-8)}</p>
                        <p className="text-teal-600 font-bold">Total: ₹{order.totalPrice}</p>
                     </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Manage Addresses Tab (🚀 NEW CODE HERE) */}
          {activeTab === 'addresses' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fade-in-up">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-gray-800">Manage Addresses</h2>
                {!showAddressForm && (
                  <button onClick={() => setShowAddressForm(true)} className="flex items-center gap-1 text-sm font-bold text-teal-600 hover:text-teal-700">
                    <Plus size={16} /> Add New
                  </button>
                )}
              </div>

              {/* Add Address Form */}
              {showAddressForm && (
                <form onSubmit={handleSaveAddress} className="mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-4">Add a new address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Full Name" required value={newAddress.fullName} onChange={(e) => setNewAddress({...newAddress, fullName: e.target.value})} className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500" />
                    <input type="text" placeholder="Phone Number" required value={newAddress.phone} onChange={(e) => setNewAddress({...newAddress, phone: e.target.value})} className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500" />
                    <input type="text" placeholder="Street / Flat / Area" required value={newAddress.street} onChange={(e) => setNewAddress({...newAddress, street: e.target.value})} className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500 md:col-span-2" />
                    <input type="text" placeholder="City" required value={newAddress.city} onChange={(e) => setNewAddress({...newAddress, city: e.target.value})} className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500" />
                    <input type="text" placeholder="State" required value={newAddress.state} onChange={(e) => setNewAddress({...newAddress, state: e.target.value})} className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500" />
                    <input type="text" placeholder="PIN Code" required value={newAddress.pinCode} onChange={(e) => setNewAddress({...newAddress, pinCode: e.target.value})} className="p-3 rounded-lg border focus:ring-teal-500 focus:border-teal-500" />
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button type="submit" disabled={addressLoading} className="bg-teal-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50">
                      {addressLoading ? 'Saving...' : 'Save Address'}
                    </button>
                    <button type="button" onClick={() => setShowAddressForm(false)} className="px-6 py-2 rounded-lg font-bold text-gray-600 bg-gray-200 hover:bg-gray-300">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* List of Saved Addresses */}
              <div className="grid grid-cols-1 gap-4">
                {addresses.length === 0 && !showAddressForm && (
                  <p className="text-gray-500">No addresses saved yet.</p>
                )}
                {addresses.map((address) => (
                  <div key={address._id} className="p-5 border border-gray-200 rounded-xl relative group hover:border-teal-500 transition-colors">
                    <h3 className="font-bold text-gray-800">{address.fullName} <span className="text-sm text-gray-500 font-normal ml-2">{address.phone}</span></h3>
                    <p className="text-gray-600 text-sm mt-2">{address.street}, {address.city}, {address.state} - {address.pinCode}</p>
                    <button onClick={() => handleDeleteAddress(address._id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors p-2 bg-gray-50 rounded-full">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Account Settings Tab */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fade-in-up">
              <h2 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-4">Account Settings</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
                  <div>
                    <h3 className="font-bold text-red-700 text-sm">Delete Account</h3>
                    <p className="text-xs text-red-500 mt-1">Permanently remove your account and all associated data.</p>
                  </div>
                  <button onClick={handleDeleteAccount} className="text-white font-bold text-sm bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition-colors shadow-sm">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ProfilePage;