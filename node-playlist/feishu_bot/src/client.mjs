import * as lark from '@larksuiteoapi/node-sdk';
import { config } from 'dotenv';

config();

/** @type {import('@larksuiteoapi/node-sdk').Client} */
let client;
export const getClient = () => {
  if (!client) {
    client = new lark.Client({
      appId: process.env.APP_ID,
      appSecret: process.env.APP_SECRET
    });
  }
  return client;
};

/** @type {import('@larksuiteoapi/node-sdk').WSClient} */
let wsClient;
export const getWSClient = () => {
  if (!wsClient) {
    wsClient = new lark.WSClient({
      appId: process.env.APP_ID,
      appSecret: process.env.APP_SECRET,
      loggerLevel: lark.LoggerLevel.debug
    });
  }
  return wsClient;
};
