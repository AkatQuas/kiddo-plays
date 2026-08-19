import { Injectable } from '@nestjs/common';

export interface AppConfig {
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    maxConnections: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
  };
  serverPort: number;
  logLevel: string;
  sqlTimeoutMs: number;
  maxRows: number;
}

@Injectable()
export class ConfigService {
  private readonly config: AppConfig = {
    db: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'pgplay',
      password: process.env.DB_PASSWORD || 'pgplay_secret',
      database: process.env.DB_NAME || 'pgplayground',
      maxConnections: 10,
      idleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
    },
    serverPort: parseInt(process.env.SERVER_PORT || '3001', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    sqlTimeoutMs: parseInt(process.env.SQL_TIMEOUT || '30000', 10),
    maxRows: 10000,
  };

  get(): AppConfig {
    return this.config;
  }
}
