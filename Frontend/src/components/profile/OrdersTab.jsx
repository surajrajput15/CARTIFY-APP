const OrdersTab = ({ orders, loading }) => (
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
        {orders.map(order => (
          <div key={order._id} className="p-4 border rounded-lg bg-gray-50">
            <p className="font-bold">Order ID: #{order._id.slice(-8)}</p>
            <p className="text-teal-600 font-bold">Total: ₹{order.totalPrice}</p>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default OrdersTab;
