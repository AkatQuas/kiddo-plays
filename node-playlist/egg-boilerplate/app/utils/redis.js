const Redis = require('ioredis');

const constants = require('./constants');

const redis = new Redis(constants.redisConf);

const customRedis = Object.assign({}, redis);

// 过期时间5400秒：90分钟，微信access token有效期：7200秒
customRedis.set = async (key, val, expired = 5400) => {
  key = constants.redisKeyPrefix + key;
  const res = await redis.set(key, val, 'EX', expired);
  return res;
};

customRedis.get = async key => {
  key = constants.redisKeyPrefix + key;
  const res = await redis.get(key);
  return res;
};

module.exports = customRedis;
