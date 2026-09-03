const Redis = require('ioredis');
const logger = require('./logger'); // We'll create this next

// Redis client with connection pooling and retry strategy
const createRedisClient = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.warn('Redis max retries reached, giving up');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
    enableReadyCheck: true,
    family: 4, // IPv4
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('ready', () => logger.info('Redis ready'));
  client.on('error', (err) => logger.error({ err }, 'Redis error'));
  client.on('close', () => logger.warn('Redis connection closed'));
  client.on('reconnecting', () => logger.info('Redis reconnecting'));

  return client;
};

// Singleton instance
let redisClient = null;

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
};

// Cache helper functions
const cache = {
  // Get cached value
  async get(key) {
    try {
      const client = getRedisClient();
      if (!client?.status === 'ready') return null;
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error({ err: error, key }, 'Cache get error');
      return null;
    }
  },

  // Set cached value with TTL
  async set(key, value, ttlSeconds = 60) {
    try {
      const client = getRedisClient();
      if (!client?.status === 'ready') return false;
      await client.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error({ err: error, key }, 'Cache set error');
      return false;
    }
  },

  // Delete cached value
  async del(key) {
    try {
      const client = getRedisClient();
      if (!client?.status === 'ready') return false;
      await client.del(key);
      return true;
    } catch (error) {
      logger.error({ err: error, key }, 'Cache del error');
      return false;
    }
  },

  // Delete multiple keys by pattern
  async delPattern(pattern) {
    try {
      const client = getRedisClient();
      if (!client?.status === 'ready') return false;
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
      return true;
    } catch (error) {
      logger.error({ err: error, pattern }, 'Cache delPattern error');
      return false;
    }
  },

  // Increment counter (for rate limiting)
  async incr(key, ttlSeconds = 60) {
    try {
      const client = getRedisClient();
      if (!client?.status === 'ready') return null;
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, ttlSeconds);
      }
      return count;
    } catch (error) {
      logger.error({ err: error, key }, 'Cache incr error');
      return null;
    }
  },

  // Health check
  async healthCheck() {
    try {
      const client = getRedisClient();
      if (!client?.status === 'ready') return false;
      const result = await client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  },

  // Close connection
  async close() {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
    }
  },
};

// Cache keys namespace
const CACHE_KEYS = {
  products: {
    list: (query) => `products:list:${JSON.stringify(query)}`,
    byId: (id) => `products:id:${id}`,
    categories: () => 'products:categories',
    invalidate: () => 'products:*',
  },
  user: {
    session: (userId) => `user:session:${userId}`,
    invalidate: (userId) => `user:session:${userId}`,
  },
  rateLimit: {
    ip: (ip) => `ratelimit:ip:${ip}`,
    user: (userId) => `ratelimit:user:${userId}`,
  },
};

module.exports = { cache, getRedisClient, CACHE_KEYS, createRedisClient };