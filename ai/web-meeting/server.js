/**
 * Web Meeting Server - Main Entry Point
 *
 * Express + Socket.io signaling + Mediasoup SFU media server.
 * Handles room management, peer signaling, and media resource lifecycle.
 */

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const mediasoupManager = require('./mediasoup');

// ─── Configuration ───────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const MAX_PEERS_PER_ROOM = 4;
const ROOM_ID_LENGTH = 6;

const SSL_DIR = path.join(__dirname, 'ssl');
const SSL_KEY = path.join(SSL_DIR, 'server.key');
const SSL_CERT = path.join(SSL_DIR, 'server.crt');

// In-memory room metadata (separate from mediasoup room state)
const roomMeta = new Map(); // roomId -> { id, createdAt }

// Track which socket.io socket ID maps to which peer ID
const socketToPeer = new Map(); // socketId -> peerId
const peerToSocket = new Map(); // peerId -> socketId
const peerToRoom = new Map(); // peerId -> roomId

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateRoomId() {
  // Generate a 6-digit numeric room ID, ensure uniqueness
  let id;
  do {
    id = String(Math.floor(100000 + Math.random() * 900000));
  } while (roomMeta.has(id));
  return id;
}

function generatePeerId() {
  return uuidv4().slice(0, 8);
}

// ─── SSL / HTTPS Setup ──────────────────────────────────────────────────────

function ensureSSLCert() {
  if (fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)) {
    return; // certs already exist
  }

  console.log('[ssl] Generating self-signed certificate...');
  fs.mkdirSync(SSL_DIR, { recursive: true });

  const subject = '/C=CN/ST=Local/L=Local/O=WebMeeting/OU=Dev/CN=localhost';

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${SSL_KEY}" -out "${SSL_CERT}" ` +
      `-days 3650 -nodes -subj "${subject}" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
      { stdio: 'ignore' }
    );
    console.log('[ssl] Self-signed certificate created');
  } catch (error) {
    console.error('[ssl] Failed to generate certificate:', error.message);
    console.log('[ssl] You can manually place server.key and server.crt in ssl/');
  }
}

function createHttpsCredentials() {
  if (!fs.existsSync(SSL_KEY) || !fs.existsSync(SSL_CERT)) {
    return null;
  }
  return {
    key: fs.readFileSync(SSL_KEY),
    cert: fs.readFileSync(SSL_CERT),
  };
}

// ─── Express Setup ───────────────────────────────────────────────────────────

const app = express();

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Redirect HTTP to HTTPS (跳过 Socket.io 轮询请求，避免破坏握手)
app.use((req, res, next) => {
  // 不重定向 Socket.io 的 polling 请求
  if (req.url.startsWith('/socket.io/')) {
    return next();
  }
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }
  // Only redirect if HTTPS server is running
  if (fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)) {
    return res.redirect(`https://${req.hostname}:${HTTPS_PORT}${req.url}`);
  }
  next();
});

const httpServer = http.createServer(app);

// ─── Socket.io Setup (先创建 engine，再分别 attach 到 HTTP/HTTPS) ────────────

const io = new Server({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e8,
});

io.attach(httpServer);

// 如果 SSL 证书存在，也 attach 到 HTTPS server（在 start() 中完成）
let httpsServer = null;

// ─── Socket.io Event Handlers ────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[socket] New connection: ${socket.id}`);

  // ── Create Room ──────────────────────────────────────────────────────────
  socket.on('createRoom', async () => {
    try {
      const roomId = generateRoomId();

      // Create mediasoup router for this room
      await mediasoupManager.createRoom(roomId);

      // Store room metadata
      roomMeta.set(roomId, {
        id: roomId,
        createdAt: Date.now(),
      });

      console.log(`[room] Created room ${roomId}`);

      socket.emit('roomCreated', { roomId });
    } catch (error) {
      console.error('[room] Error creating room:', error);
      socket.emit('error', { message: '创建房间失败: ' + error.message });
    }
  });

  // ── Join Room ────────────────────────────────────────────────────────────
  socket.on('joinRoom', async ({ roomId } = {}) => {
    try {
      if (!roomId || !roomMeta.has(roomId)) {
        socket.emit('error', { message: '房间不存在，请检查房间号' });
        return;
      }

      const currentCount = mediasoupManager.getRoomPeerCount(roomId);
      if (currentCount >= MAX_PEERS_PER_ROOM) {
        socket.emit('error', { message: '房间人数已满（最大4人），无法加入' });
        return;
      }

      const peerId = generatePeerId();

      // Track mappings
      socketToPeer.set(socket.id, peerId);
      peerToSocket.set(peerId, socket.id);
      peerToRoom.set(peerId, roomId);

      // Add peer to room
      mediasoupManager.addPeerToRoom(roomId, peerId);

      // Join the Socket.io room
      socket.join(roomId);

      // Store peerId on socket for easy access
      socket.data.peerId = peerId;
      socket.data.roomId = roomId;

      console.log(
        `[room] Peer ${peerId} joined room ${roomId} (${currentCount + 1}/${MAX_PEERS_PER_ROOM})`
      );

      // Notify the joining peer about existing peers and their producers
      const existingPeers = mediasoupManager.getRoomPeers(roomId);
      const otherPeers = existingPeers.filter((p) => p !== peerId);

      // Collect all existing producers from other peers in the room
      const existingProducers = mediasoupManager.getAllProducersInRoom(roomId)
        .filter((p) => p.peerId !== peerId);

      socket.emit('roomJoined', {
        roomId,
        peerId,
        peers: otherPeers,
        producers: existingProducers,
        maxPeers: MAX_PEERS_PER_ROOM,
      });

      // Notify other peers in the room about the new peer
      socket.to(roomId).emit('newPeer', { peerId });

      // Notify all peers in the room (including the new one) about updated count
      io.to(roomId).emit('peerCountChanged', {
        count: currentCount + 1,
        max: MAX_PEERS_PER_ROOM,
      });
    } catch (error) {
      console.error('[room] Error joining room:', error);
      socket.emit('error', { message: '加入房间失败: ' + error.message });
    }
  });

  // ── Get Router RTP Capabilities ──────────────────────────────────────────
  socket.on('getRouterRtpCapabilities', ({ roomId } = {}) => {
    try {
      const caps = mediasoupManager.getRouterRtpCapabilities(roomId);
      socket.emit('routerRtpCapabilities', { rtpCapabilities: caps });
    } catch (error) {
      console.error('[mediasoup] Error getting capabilities:', error);
      socket.emit('error', { message: '获取媒体能力失败' });
    }
  });

  // ── Create Send Transport ────────────────────────────────────────────────
  socket.on('createSendTransport', async ({ roomId } = {}) => {
    try {
      const peerId = socket.data.peerId;
      const transportParams = await mediasoupManager.createSendTransport(
        roomId,
        peerId
      );

      // Add callback events for the transport
      const room = mediasoupManager.getRoom(roomId);

      // We need to emit events through the socket for the client's transport
      socket.emit('sendTransportCreated', {
        ...transportParams,
        // Additional callback wiring
      });
    } catch (error) {
      console.error('[mediasoup] Error creating send transport:', error);
      socket.emit('error', { message: '创建上行传输通道失败' });
    }
  });

  // ── Create Recv Transport ────────────────────────────────────────────────
  socket.on('createRecvTransport', async ({ roomId } = {}) => {
    try {
      const peerId = socket.data.peerId;
      const transportParams = await mediasoupManager.createRecvTransport(
        roomId,
        peerId
      );

      socket.emit('recvTransportCreated', {
        ...transportParams,
      });
    } catch (error) {
      console.error('[mediasoup] Error creating recv transport:', error);
      socket.emit('error', { message: '创建下行传输通道失败' });
    }
  });

  // ── Connect Send Transport ───────────────────────────────────────────────
  socket.on('connectSendTransport', async ({ dtlsParameters } = {}) => {
    try {
      const peerId = socket.data.peerId;
      await mediasoupManager.connectSendTransport(peerId, dtlsParameters);
      socket.emit('sendTransportConnected');
    } catch (error) {
      console.error('[mediasoup] Error connecting send transport:', error);
      socket.emit('error', { message: '连接上行传输通道失败' });
    }
  });

  // ── Connect Recv Transport ───────────────────────────────────────────────
  socket.on('connectRecvTransport', async ({ dtlsParameters } = {}) => {
    try {
      const peerId = socket.data.peerId;
      await mediasoupManager.connectRecvTransport(peerId, dtlsParameters);
      socket.emit('recvTransportConnected');
    } catch (error) {
      console.error('[mediasoup] Error connecting recv transport:', error);
      socket.emit('error', { message: '连接下行传输通道失败' });
    }
  });

  // ── Produce ──────────────────────────────────────────────────────────────
  socket.on('produce', async ({ transportId, kind, rtpParameters } = {}) => {
    try {
      const peerId = socket.data.peerId;
      const roomId = socket.data.roomId;

      const { id: producerId } = await mediasoupManager.createProducer(
        peerId,
        transportId,
        kind,
        rtpParameters
      );

      socket.emit('produced', { id: producerId, kind });

      // Notify other peers in the room about the new producer
      socket.to(roomId).emit('newProducer', {
        peerId,
        producerId,
        kind,
      });

      console.log(
        `[mediasoup] ${kind} producer ${producerId} from ${peerId} in room ${roomId}`
      );
    } catch (error) {
      console.error('[mediasoup] Error producing:', error);
      socket.emit('error', { message: '推送媒体流失败' });
    }
  });

  // ── Consume ──────────────────────────────────────────────────────────────
  socket.on('consume', async ({ producerId, rtpCapabilities } = {}) => {
    try {
      const peerId = socket.data.peerId;

      const consumerData = await mediasoupManager.createConsumer(
        peerId,
        producerId,
        rtpCapabilities
      );

      socket.emit('consumed', {
        id: consumerData.id,
        producerId: consumerData.producerId,
        kind: consumerData.kind,
        rtpParameters: consumerData.rtpParameters,
        type: consumerData.type,
        producerPaused: consumerData.producerPaused,
      });

      console.log(
        `[mediasoup] Consumer ${consumerData.id} for ${producerId} -> ${peerId}`
      );
    } catch (error) {
      console.error('[mediasoup] Error consuming:', error);
      socket.emit('error', { message: '订阅媒体流失败' });
    }
  });

  // ── Resume Consumer ──────────────────────────────────────────────────────
  socket.on('resumeConsumer', async ({ consumerId } = {}) => {
    try {
      mediasoupManager.resumeConsumer(consumerId);
    } catch (error) {
      console.error('[mediasoup] Error resuming consumer:', error);
    }
  });

  // ── Close Producer ───────────────────────────────────────────────────────
  socket.on('closeProducer', ({ producerId } = {}) => {
    try {
      const peerId = socket.data.peerId;
      const roomId = socket.data.roomId;
      mediasoupManager.closeProducer(peerId, producerId);

      // Notify other peers
      socket.to(roomId).emit('producerClosed', { peerId, producerId });
    } catch (error) {
      console.error('[mediasoup] Error closing producer:', error);
    }
  });

  // ── Leave Room ───────────────────────────────────────────────────────────
  socket.on('leaveRoom', async () => {
    await handlePeerLeave(socket);
  });

  // ── Disconnect ───────────────────────────────────────────────────────────
  socket.on('disconnect', async (reason) => {
    console.log(`[socket] Disconnected: ${socket.id} (reason: ${reason})`);
    await handlePeerLeave(socket);
  });
});

// ─── Peer Leave Handler ──────────────────────────────────────────────────────

async function handlePeerLeave(socket) {
  const peerId = socket.data.peerId;
  const roomId = socket.data.roomId;

  if (!peerId || !roomId) return;

  console.log(`[room] Peer ${peerId} leaving room ${roomId}`);

  try {
    // Get the producers this peer had before cleanup
    const peerProducers = mediasoupManager.getPeerProducers(peerId);

    // Clean up all mediasoup resources for this peer
    await mediasoupManager.clearPeerResources(peerId);

    // Notify other peers about each closed producer
    for (const producer of peerProducers) {
      socket.to(roomId).emit('producerClosed', {
        peerId,
        producerId: producer.id,
      });
    }

    // Notify other peers that this peer left
    socket.to(roomId).emit('peerLeft', { peerId });

    // Remove from room
    mediasoupManager.removePeerFromRoom(roomId, peerId);

    // Leave the Socket.io room
    socket.leave(roomId);

    // Clean up tracking
    socketToPeer.delete(socket.id);
    peerToSocket.delete(peerId);
    peerToRoom.delete(peerId);
    delete socket.data.peerId;
    delete socket.data.roomId;

    // Check if room is now empty
    const remaining = mediasoupManager.getRoomPeerCount(roomId);

    // Update remaining peers about count
    io.to(roomId).emit('peerCountChanged', {
      count: remaining,
      max: MAX_PEERS_PER_ROOM,
    });

    // Destroy room if empty
    if (remaining === 0) {
      await mediasoupManager.destroyRoom(roomId);
      roomMeta.delete(roomId);
      console.log(`[room] Room ${roomId} destroyed (empty)`);
    } else {
      console.log(`[room] ${remaining} peers remaining in room ${roomId}`);
    }
  } catch (error) {
    console.error('[room] Error during peer leave:', error);
  }
}

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

async function gracefulShutdown(signal) {
  console.log(`\n[shutdown] Received ${signal}, starting graceful shutdown...`);

  // Step 1: Stop accepting new connections
  httpServer.close(() => {
    console.log('[shutdown] HTTP server closed');
  });
  if (httpsServer) {
    httpsServer.close(() => {
      console.log('[shutdown] HTTPS server closed');
    });
  }

  // Step 2: Disconnect all Socket.io clients
  const sockets = await io.fetchSockets();
  console.log(`[shutdown] Disconnecting ${sockets.length} client(s)...`);

  const leavePromises = [];
  for (const socket of sockets) {
    leavePromises.push(handlePeerLeave(socket).catch(() => {}));
  }
  await Promise.allSettled(leavePromises);

  // Step 3: Close Socket.io server
  io.close(() => {
    console.log('[shutdown] Socket.io server closed');
  });

  // Step 4: Destroy all remaining mediasoup rooms
  const roomIds = Array.from(roomMeta.keys());
  for (const roomId of roomIds) {
    try {
      await mediasoupManager.destroyRoom(roomId);
      roomMeta.delete(roomId);
    } catch (err) {
      console.error(`[shutdown] Error destroying room ${roomId}:`, err);
    }
  }

  // Step 5: Close mediasoup worker
  const worker = mediasoupManager.getWorker();
  if (worker && !worker.closed) {
    worker.close();
    console.log('[shutdown] Mediasoup worker closed');
  }

  console.log('[shutdown] Graceful shutdown complete');
  process.exit(0);
}

// ─── Signal Handlers ─────────────────────────────────────────────────────────

function setupSignalHandlers() {
  let shuttingDown = false;

  const handleSignal = async (signal) => {
    if (shuttingDown) {
      console.log(`[shutdown] ${signal} received again, forcing exit`);
      process.exit(1);
    }
    shuttingDown = true;

    // Force exit after 10s if graceful shutdown hangs
    const forceExit = setTimeout(() => {
      console.error('[shutdown] Force exit after timeout');
      process.exit(1);
    }, 10000);
    forceExit.unref();

    await gracefulShutdown(signal);
  };

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
}

// ─── Startup ─────────────────────────────────────────────────────────────────

async function start() {
  // Register signal handlers for graceful shutdown
  setupSignalHandlers();

  try {
    // Initialize mediasoup worker
    await mediasoupManager.createWorker();

    // Generate SSL cert if needed
    ensureSSLCert();

    // ── 初始化 HTTPS + 挂载 io ─────────────────────────────────────────
    const credentials = createHttpsCredentials();
    if (credentials) {
      httpsServer = https.createServer(credentials, app);
      io.attach(httpsServer);  // Socket.io 也绑到 HTTPS
    }

    // ── 启动 HTTP（始终启动） ─────────────────────────────────────────
    httpServer.listen(PORT, () => {
      console.log('');
      console.log('╔═══════════════════════════════════════════════╗');
      console.log('║         Web Meeting Server Started           ║');
      console.log(`║     HTTP  : http://localhost:${PORT}              ║`);

      if (credentials) {
        console.log(`║     HTTPS : https://0.0.0.0:${HTTPS_PORT}            ║`);
        console.log('║     (self-signed cert, browser warning is OK)    ║');
        console.log('╚═══════════════════════════════════════════════╝');
      } else {
        console.log('╚═══════════════════════════════════════════════╝');
        console.log('[ssl] To enable HTTPS, install openssl or place ssl/server.{key,crt}');
      }
      console.log('');
    });

    // ── 启动 HTTPS（证书存在时） ────────────────────────────────────
    if (credentials) {
      httpsServer.listen(HTTPS_PORT);
    }
  } catch (error) {
    console.error('[server] Failed to start:', error);
    process.exit(1);
  }
}

start();
