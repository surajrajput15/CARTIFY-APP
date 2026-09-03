import { getStockStatus } from '../utils/stockStatus';
import { memo } from 'react';

const SIZE_CLASSES = {
  sm: 'inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider',
  md: 'inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full',
};

const StockBadge = memo(({ countInStock, size = 'md', className = '' }) => {
  const status = getStockStatus(countInStock);
  if (!status) return null;

  return (
    <span className={`${SIZE_CLASSES[size]} ${status.bgColor} ${status.textColor} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
      {status.label}
    </span>
  );
});

StockBadge.displayName = 'StockBadge';

export default StockBadge;
