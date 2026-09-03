const { z } = require('zod');

// Auth schemas
const schemas = {
  // Register schema
  register: z.object({
    name: z.string().min(1).max(100).trim(),
    email: z.string().email().max(255).toLowerCase().trim(),
    password: z.string().min(8).max(128).regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
    otp: z.string().regex(/^\d{6}$/).optional(),
  }),

  // Login schema
  login: z.object({
    email: z.string().email().max(255).toLowerCase().trim(),
    password: z.string().min(1).max(128),
  }),

  // Send OTP schema
  sendOtp: z.object({
    email: z.string().email().max(255).toLowerCase().trim(),
  }),

  // Verify OTP schema
  verifyOtp: z.object({
    email: z.string().email().max(255).toLowerCase().trim(),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
  }),

  // Forgot password schema
  forgotPassword: z.object({
    email: z.string().email().max(255).toLowerCase().trim(),
  }),

  // Reset password schema
  resetPassword: z.object({
    email: z.string().email().max(255).toLowerCase().trim(),
    otp: z.string().regex(/^\d{6}$/),
    newPassword: z.string().min(8).max(128).regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  }),

  // Google login schema
  googleLogin: z.object({
    credential: z.string().min(1),
  }),

  // Update profile schema
  updateProfile: z.object({
    name: z.string().min(1).max(100).trim(),
  }),

  // Address schemas
  addAddress: z.object({
    fullName: z.string().min(1).max(100).trim(),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian number'),
    street: z.string().min(1).max(200).trim(),
    city: z.string().min(1).max(100).trim(),
    state: z.string().min(1).max(100).trim(),
    pinCode: z.string().regex(/^\d{6}$/, 'PIN code must be exactly 6 digits'),
  }),

  // Product schemas
  addProduct: z.object({
    title: z.string().min(1).max(200).trim(),
    description: z.string().min(1).max(2000).trim(),
    price: z.number().positive().max(10000000),
    category: z.string().min(1).max(100).trim(),
    image: z.string().min(1).max(500).trim(),
    rating: z.object({
      rate: z.number().min(0).max(5).optional(),
      count: z.number().int().min(0).optional(),
    }).optional(),
    countInStock: z.number().int().min(0).max(100000).optional(),
  }),

  updateProduct: z.object({
    title: z.string().min(1).max(200).trim().optional(),
    description: z.string().min(1).max(2000).trim().optional(),
    price: z.number().positive().max(10000000).optional(),
    category: z.string().min(1).max(100).trim().optional(),
    image: z.string().min(1).max(500).trim().optional(),
    rating: z.object({
      rate: z.number().min(0).max(5).optional(),
      count: z.number().int().min(0).optional(),
    }).optional(),
    countInStock: z.number().int().min(0).max(100000).optional(),
  }),

  // Cart schemas
  cartItem: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
    quantity: z.number().int().min(1).max(20),
  }),

  syncCart: z.object({
    items: z.array(z.object({
      productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
      _id: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
      id: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
      quantity: z.number().int().min(1).max(20),
    })).max(100),
  }),

  mergeCart: z.object({
    items: z.array(z.object({
      productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
      _id: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
      id: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
      quantity: z.number().int().min(1).max(20),
    })).max(100),
  }),

  // Order schemas
  createOrder: z.object({
    items: z.array(z.object({
      productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
      quantity: z.number().int().min(1).max(20),
    })).min(1).max(50),
    shippingAddress: z.object({
      fullName: z.string().min(1).max(100).trim(),
      phone: z.string().regex(/^[6-9]\d{9}$/),
      street: z.string().min(1).max(200).trim(),
      city: z.string().min(1).max(100).trim(),
      state: z.string().min(1).max(100).trim(),
      pinCode: z.string().regex(/^\d{6}$/),
    }),
  }),

  verifyPayment: z.object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  }),

  updateOrderStatus: z.object({
    status: z.enum(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']),
  }),

  // Pagination schema
  pagination: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  }),

  // Product list query schema
  productQuery: z.object({
    search: z.string().max(100).trim().optional(),
    category: z.string().max(100).trim().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('12'),
  }),
};

// Validation middleware factory
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const validated = schema.parse(data);
      
      if (source === 'body') req.body = validated;
      else if (source === 'query') req.query = validated;
      else req.params = validated;
      
      next();
    } catch (error) {
      if (error.errors) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        });
      }
      return res.status(400).json({ message: 'Invalid request data' });
    }
  };
};

module.exports = { schemas, validate, z };