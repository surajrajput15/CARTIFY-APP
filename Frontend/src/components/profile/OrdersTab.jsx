const OrdersTab = ({ orders, loading }) => {
  const getPaymentLabel = (status) => {
    if (status === 'Paid') return { label: 'Paid', className: 'bg-green-50 text-green-700' };
    return { label: 'Payment Pending', className: 'bg-yellow-50 text-yellow-700' };
  };

  const getOrderLabel = (status) => {
    if (status === 'Delivered') return { label: 'Delivered', className: 'bg-teal-50 text-teal-700' };
    if (status === 'Processing') return { label: 'Processing', className: 'bg-blue-50 text-blue-700' };
    return { label: 'Pending', className: 'bg-gray-100 text-gray-600' };
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 animate-fade-in-up">
      <h2 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-4">Recent Orders</h2>
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 border border-gray-100 rounded-lg bg-gray-50">
              <div className="h-4 w-40 bg-gray-200 rounded mb-3"></div>
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="text-gray-500">Your order history will appear here once you make a purchase.</p>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const payment = getPaymentLabel(order.paymentStatus);
            const orderStatus = getOrderLabel(order.status);
            return (
              <div key={order._id} className="p-4 border rounded-lg bg-gray-50">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="font-bold">Order ID: #{order._id.slice(-8)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${payment.className}`}>{payment.label}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${orderStatus.className}`}>{orderStatus.label}</span>
                  </div>
                </div>
                <p className="text-teal-600 font-bold">Total: ₹{order.totalPrice}</p>
                {order.paidAt && (
                  <p className="text-gray-500 text-xs mt-1">Paid on {new Date(order.paidAt).toLocaleDateString()}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrdersTab;
