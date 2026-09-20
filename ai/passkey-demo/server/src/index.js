import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { connectRedis, closeRedis } from './redis/client.js';
import { sessionMiddleware } from './middleware/session.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import passkeysRoutes from './routes/passkeys.js';
import protectedRoutes from './routes/protected.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

const app = express();

app.set('trust proxy', 1);
app.use(morgan('dev'));

if (config.isProd) {
  app.use(
    cors({
      origin: config.origin,
      credentials: true,
    }),
  );
}

app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));
app.use(sessionMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/passkeys', passkeysRoutes);
app.use('/api/protected', protectedRoutes);

if (config.isProd) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

async function start() {
  try {
    await connectRedis();
    console.log('Redis connected');
  } catch (err) {
    console.error('Failed to connect to Redis:', err.message);
    console.error('Start Redis with: docker compose up -d');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
    console.log(`WebAuthn origin: ${config.origin}, RP ID: ${config.rpId}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
      await closeRedis();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
