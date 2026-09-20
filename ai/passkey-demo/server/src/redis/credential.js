import { getRedis } from './client.js';

function parseCredential(credentialId, data) {
  if (!data || !data.userId) return null;
  return {
    credentialId,
    userId: data.userId,
    publicKey: data.publicKey,
    counter: Number(data.counter || 0),
    deviceName: data.deviceName || 'Passkey',
    backedUp: data.backedUp === 'true',
    transports: JSON.parse(data.transports || '[]'),
    createdAt: data.createdAt,
    lastUsedAt: data.lastUsedAt,
  };
}

export async function getCredential(credentialId) {
  const redis = getRedis();
  const data = await redis.hgetall(`cred:${credentialId}`);
  return parseCredential(credentialId, data);
}

export async function listUserCredentials(userId) {
  const redis = getRedis();
  const ids = await redis.smembers(`user:${userId}:creds`);
  const creds = await Promise.all(ids.map((id) => getCredential(id)));
  return creds.filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function countUserCredentials(userId) {
  const redis = getRedis();
  return redis.scard(`user:${userId}:creds`);
}

export async function saveCredential(userId, credential) {
  const redis = getRedis();
  const now = new Date().toISOString();
  const multi = redis.multi();
  multi.hset(`cred:${credential.credentialId}`, {
    userId,
    publicKey: credential.publicKey,
    counter: String(credential.counter),
    deviceName: credential.deviceName,
    backedUp: String(credential.backedUp),
    transports: JSON.stringify(credential.transports || []),
    createdAt: now,
    lastUsedAt: now,
  });
  multi.sadd(`user:${userId}:creds`, credential.credentialId);
  await multi.exec();
  return getCredential(credential.credentialId);
}

export async function updateCounter(credentialId, counter) {
  const redis = getRedis();
  const now = new Date().toISOString();
  await redis.hset(`cred:${credentialId}`, {
    counter: String(counter),
    lastUsedAt: now,
  });
}

export async function deleteCredential(userId, credentialId) {
  const redis = getRedis();
  const cred = await getCredential(credentialId);
  if (!cred || cred.userId !== userId) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  const multi = redis.multi();
  multi.del(`cred:${credentialId}`);
  multi.srem(`user:${userId}:creds`, credentialId);
  await multi.exec();
  return { ok: true };
}
