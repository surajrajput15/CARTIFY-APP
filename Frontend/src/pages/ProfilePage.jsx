import { useEffect, useState } from 'react';
import { useAuth } from '../context/authContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useOrders } from '../hooks/useOrders';
import { useAddresses } from '../hooks/useAddresses';
import { useProfile } from '../hooks/useProfile';
import ConfirmModal from '../components/ConfirmModal';
import ProfileSidebar from '../components/profile/ProfileSidebar';
import ProfileInfo from '../components/profile/ProfileInfo';
import OrdersTab from '../components/profile/OrdersTab';
import AddressManager from '../components/profile/AddressManager';
import SettingsTab from '../components/profile/SettingsTab';

const CLOSED_CONFIRM = { show: false, title: '', message: '', onConfirm: null, loading: false };

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [confirmModal, setConfirmModal] = useState(CLOSED_CONFIRM);

  const { orders, loadingOrders, fetchOrders } = useOrders(user?.id);
  const { addresses, addressesLoading, fetchAddresses, saveAddress, deleteAddress } = useAddresses(user?.id, false);
  const { isEditing, editName, setEditName, updateLoading, handleToggleEdit, handleUpdateProfile, deleteAccount } = useProfile();

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === 'orders' && user) {
      fetchOrders();
    }
    if (activeTab === 'addresses' && user) {
      fetchAddresses();
    }
  }, [activeTab, user, fetchOrders, fetchAddresses]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleDeleteAccount = () => {
    setConfirmModal({
      show: true,
      title: 'Delete Account',
      message: 'Are you sure you want to permanently delete your account? This cannot be undone.',
      loading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        await deleteAccount();
        setConfirmModal(CLOSED_CONFIRM);
      }
    });
  };

  const handleDeleteAddress = (id) => {
    setConfirmModal({
      show: true,
      title: 'Delete Address',
      message: 'Delete this address permanently?',
      loading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          await deleteAddress(id);
          toast.success('Address deleted');
        } catch {
          toast.error("Failed to delete address");
        } finally {
          setConfirmModal(CLOSED_CONFIRM);
        }
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">My Account</h1>

      <div className="flex flex-col md:flex-row gap-8">
        <ProfileSidebar user={user} activeTab={activeTab} onTabChange={handleTabChange} onLogout={handleLogout} />

        <div className="w-full md:w-3/4 space-y-6">
          {activeTab === 'profile' && (
            <ProfileInfo
              user={user}
              isEditing={isEditing}
              editName={editName}
              updateLoading={updateLoading}
              onToggleEdit={handleToggleEdit}
              onEditNameChange={(e) => setEditName(e.target.value)}
              onSave={handleUpdateProfile}
            />
          )}

          {activeTab === 'orders' && <OrdersTab orders={orders} loading={loadingOrders} />}

          {activeTab === 'addresses' && (
            <AddressManager
              addresses={addresses}
              addressesLoading={addressesLoading}
              onSaveAddress={saveAddress}
              onDeleteAddress={handleDeleteAddress}
            />
          )}

          {activeTab === 'settings' && <SettingsTab onDeleteAccount={handleDeleteAccount} />}
        </div>
      </div>

      {confirmModal.show && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.title === 'Delete Account' ? 'Delete My Account' : 'Delete'}
          cancelLabel="Cancel"
          loading={confirmModal.loading}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(CLOSED_CONFIRM)}
        />
      )}
    </div>
  );
};

export default ProfilePage;
