import { Loader2 } from 'lucide-react';
import { memo } from 'react';

const Spinner = memo(({ className, label = 'Loading' }) => (
  <div className="text-center py-20" role="status" aria-live="polite">
    <Loader2 className={`animate-spin mx-auto text-teal-600 ${className || ''}`} size={40} aria-hidden="true" />
    <span className="sr-only">{label}…</span>
  </div>
));

Spinner.displayName = 'Spinner';

export default Spinner;
