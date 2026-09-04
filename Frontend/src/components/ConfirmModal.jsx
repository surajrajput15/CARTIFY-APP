import { AlertTriangle, X, Loader2 } from 'lucide-react';
import Modal from './Modal';

const ConfirmModal = ({ title, message, confirmLabel, cancelLabel, loading, onConfirm, onCancel }) => {
  return (
    <Modal title={title} onClose={onCancel} className="max-w-sm p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-50 p-2 rounded-full flex-shrink-0">
            <AlertTriangle size={24} className="text-red-500" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
        <button
          onClick={onCancel}
          aria-label="Close dialog"
          className="text-gray-400 hover:text-gray-600 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 -mt-1 rounded-lg hover:bg-gray-100"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <p className="text-gray-600 text-sm mb-6">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 bg-red-500 text-white py-2.5 rounded-lg font-bold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : null}
          {confirmLabel || 'Confirm'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 min-h-[44px]"
        >
          {cancelLabel || 'Cancel'}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;