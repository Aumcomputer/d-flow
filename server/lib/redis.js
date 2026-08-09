const { createClient } = require('redis');

let client;

module.exports = {
  initRedis: async () => {
    if (client) return client;

    const redisHost = process.env.REDIS_HOST || '127.0.0.1';
    const redisPort = process.env.REDIS_PORT || 6379;
    const redisPassword = process.env.REDIS_PASSWORD || '';
    
    const redisUrl = redisPassword 
      ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
      : `redis://${redisHost}:${redisPort}`;

    client = createClient({ url: redisUrl });
    
    client.on('error', (err) => console.error('Redis Client Error', err));
    
    await client.connect();
    console.log('Redis connected successfully');
    return client;
  },
  getRedisClient: () => {
    if (!client) throw new Error('Redis not initialized');
    return client;
  }
};
