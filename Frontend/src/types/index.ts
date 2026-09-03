// User types
export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface AuthState {
  user: User | null;
  authLoading: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

// Product types
export interface Product {
  _id: string;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;
  countInStock: number;
  rating: {
    rate: number;
    count: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  pages: number;
}

// Cart types
export interface CartItem {
  _id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
  description?: string;
  category?: string;
  countInStock?: number;
  rating?: { rate: number; count: number };
}

export interface CartResponse {
  items: CartItem[];
}

// Address types
export interface Address {
  _id?: string;
  userId?: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
}

// Order types
export type OrderStatus = 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
export type PaymentStatus = 'Pending' | 'Paid' | 'Refunded';

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pinCode: string;
}

export interface Order {
  _id: string;
  userId: string | { _id: string; name: string; email: string };
  orderItems: OrderItem[];
  shippingAddress: ShippingAddress;
  totalPrice: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  refundId?: string;
  stockShortfall?: boolean;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
}

export interface OrderListResponse {
  orders: Order[];
  total: number;
  page: number;
  pages: number;
}

// API Response types
export interface ApiError {
  message: string;
  errors?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

// Auth API types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  otp?: string;
}

export interface OtpData {
  email: string;
  otp: string;
}

export interface GoogleLoginData {
  credential: string;
}

// Payment types
export interface CreateOrderRequest {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress: ShippingAddress;
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}