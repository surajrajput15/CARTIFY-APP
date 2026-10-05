export const getStockStatus = (countInStock, threshold = 10) => {
  if (countInStock === undefined || countInStock === null) return null;

  if (countInStock <= 0) {
    return {
      label: 'Out of Stock',
      textColor: 'text-red-700',
      bgColor: 'bg-red-50',
      dotColor: 'bg-red-500',
      disabled: true,
    };
  }

  const lowLimit = Math.max(1, Number(threshold) || 10);
  if (countInStock <= lowLimit) {
    return {
      label: 'Low Stock',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
      dotColor: 'bg-amber-500',
      disabled: false,
    };
  }

  return {
    label: 'In Stock',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    dotColor: 'bg-green-500',
    disabled: false,
  };
};
