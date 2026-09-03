const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cartify API',
      version: '1.0.0',
      description: 'E-commerce platform API with authentication, products, cart, orders, and payments',
      contact: {
        name: 'Cartify Support',
        email: 'support@cartify.com',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Development server',
      },
      {
        url: 'https://cartify-api-10g3.onrender.com/api/v1',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken',
        },
        csrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            isAdmin: { type: 'boolean', example: false },
          },
        },
        Product: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            title: { type: 'string', example: 'MacBook Pro' },
            price: { type: 'number', example: 1299.99 },
            description: { type: 'string', example: 'High-performance laptop' },
            category: { type: 'string', example: 'electronics' },
            image: { type: 'string', example: 'https://example.com/image.jpg' },
            countInStock: { type: 'number', example: 10 },
            rating: {
              type: 'object',
              properties: {
                rate: { type: 'number', example: 4.5 },
                count: { type: 'number', example: 100 },
              },
            },
          },
        },
        CartItem: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            title: { type: 'string', example: 'MacBook Pro' },
            price: { type: 'number', example: 1299.99 },
            image: { type: 'string', example: 'https://example.com/image.jpg' },
            quantity: { type: 'integer', example: 1 },
          },
        },
        Order: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            userId: { type: 'string', example: '507f1f77bcf86cd799439011' },
            orderItems: { type: 'array', items: { $ref: '#/components/schemas/CartItem' } },
            shippingAddress: {
              type: 'object',
              properties: {
                fullName: { type: 'string' },
                phone: { type: 'string' },
                street: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                pinCode: { type: 'string' },
              },
            },
            totalPrice: { type: 'number', example: 1299.99 },
            status: { type: 'string', enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'] },
            paymentStatus: { type: 'string', enum: ['Pending', 'Paid', 'Refunded'] },
            razorpayOrderId: { type: 'string' },
            razorpayPaymentId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Address: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            userId: { type: 'string' },
            fullName: { type: 'string' },
            phone: { type: 'string' },
            street: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            pinCode: { type: 'string' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Error message' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            pages: { type: 'integer', example: 5 },
            total: { type: 'integer', example: 100 },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        ValidationError: {
          description: 'Invalid request data',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Products', description: 'Product management' },
      { name: 'Cart', description: 'Shopping cart' },
      { name: 'Orders', description: 'Order management' },
      { name: 'Addresses', description: 'User addresses' },
      { name: 'Payments', description: 'Payment processing' },
      { name: 'Health', description: 'Health check endpoints' },
    ],
  },
  apis: ['./routes/*.js', './models/*.js'],
};

const specs = swaggerJsdoc(options);

const setupSwagger = (app) => {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Cartify API Documentation',
  }));
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

module.exports = { setupSwagger, specs };