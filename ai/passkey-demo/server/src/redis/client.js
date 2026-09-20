import Redis from 'ioredis';
import { config } from '../config.js';

let redis = null;

export function getRedis() {
  if (!redis) {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

export async function connectRedis() {
  const client = getRedis();
  await client.connect();
  await client.ping();
  return client;
}

export async function closeRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
