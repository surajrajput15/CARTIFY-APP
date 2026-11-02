const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Mock sendEmail to avoid actual email sending in tests
jest.mock('./utils/sendEmail', () => jest.fn().mockResolvedValue('ok'), { virtual: true });

let mongoServer;

// Increase default timeout to 60s so MongoMemoryServer binary startup on Windows never times out
jest.setTimeout(60000);

// Setup before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
  process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  process.env.BREVO_API_KEY = 'test-brevo-key';
  process.env.EMAIL_USER = 'test@test.com';
  process.env.EMAIL_PASS = 'test-pass';
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-api-key';
  process.env.CLOUDINARY_API_SECRET = 'test-api-secret';
  process.env.NODE_ENV = 'test';

  await mongoose.connect(uri);
}, 60000);

// Cleanup after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}, 30000);

// Teardown after all tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
}, 60000);

// Suppress console.log during tests unless DEBUG=true
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}