import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { subscribeCanInstall, promptInstall, isStandalone } from '../utils/pwa';

const InstallButton = () => {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const unsubscribe = subscribeCanInstall((canInstall) => {
      setVisible(canInstall);
    });

    return unsubscribe;
  }, []);

  const handleInstall = async () => {
    try {
      const accepted = await promptInstall();
      if (accepted) {
        toast.success('Cartify installed! Open it from your home screen.');
        setVisible(false);
      }
    } catch (err) {
      console.error('Install prompt error:', err);
      toast.error('Could not install the app. Try again later.');
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
  };

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[70] flex items-center gap-2 bg-white rounded-2xl shadow-xl border border-teal-100 p-2 pr-3 animate-fade-in-up">
      <button
        type="button"
        onClick={handleInstall}
        className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
      >
        <Download size={16} aria-hidden="true" />
        Install App
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-gray-400 hover:text-gray-600 text-sm font-medium px-1 transition-colors"
        aria-label="Dismiss install prompt"
      >
        ✕
      </button>
    </div>
  );
};

export default InstallButton;