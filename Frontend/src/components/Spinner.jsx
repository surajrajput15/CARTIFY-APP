import { Loader2 } from 'lucide-react';

const Spinner = ({ className }) => (
  <div className="text-center py-20">
    <Loader2 className={`animate-spin mx-auto text-teal-600 ${className || ''}`} size={40} />
  </div>
);

export default Spinner;
