export const getStockStatus = (countInStock) => {
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

  if (countInStock <= 10) {
    return {
      label: 'Low Stock',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
      dotColor: 'bg-orange-400',
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
