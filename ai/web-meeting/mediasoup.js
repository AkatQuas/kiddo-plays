/**
 * Mediasoup Manager - SFU Media Server Core
 *
 * Manages mediasoup Workers, Routers, Transports, Producers, and Consumers.
 * Single Worker for MVP, one Router per room, transports/producers/consumers per peer.
 */

const mediasoup = require('mediasoup');
const path = require('path');
const fs = require('fs');

// ─── Configuration ───────────────────────────────────────────────────────────

// ─── 获取本机局域网 IP ─────────────────────────────────────────────────────

function getLocalIP() {
  const interfaces = require('os').networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内环、IPv6、非局域网
      if (iface.internal || iface.family !== 'IPv4') continue;
      return iface.address;
    }
  }
  return '127.0.0.1';
}

const CONFIG = {
  worker: {
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
    ],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp: process.env.ANNOUNCED_IP || getLocalIP(),
      },
    ],
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
    maxIncomingBitrate: 1500000,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  },
};

// ─── State ───────────────────────────────────────────────────────────────────

let worker = null;
const rooms = new Map(); // roomId -> { router, peers: Map() }
const peerTransports = new Map(); // peerId -> { sendTransport, recvTransport }
const peerProducers = new Map(); // peerId -> Map<producerId, Producer>
const peerConsumers = new Map(); // peerId -> Map<consumerId, Consumer>

// ─── Worker ──────────────────────────────────────────────────────────────────

async function createWorker() {
  if (worker) return worker;
  
  console.log(`[mediasoup] Creating worker (announced IP: ${CONFIG.webRtcTransport.listenIps[0].announcedIp})...`);

  // Use worker binary from custom path to bypass macOS code signing restrictions
  const customWorkerPath = path.join(
    __dirname,
    'worker-bin',
    'out',
    'Release',
    'mediasoup-worker'
  );
  const defaultWorkerPath = path.join(
    __dirname,
    'node_modules',
    'mediasoup',
    'worker',
    'out',
    'Release',
    'mediasoup-worker'
  );
  const workerBin = fs.existsSync(customWorkerPath)
    ? customWorkerPath
    : defaultWorkerPath;

  const workerConfig = {
    ...CONFIG.worker,
    workerBin,
  };

  worker = await mediasoup.createWorker(workerConfig);

  worker.on('died', () => {
    console.error('[mediasoup] Worker died, exiting...');
    process.exit(1);
  });

  console.log(`[mediasoup] Worker created (pid: ${worker.pid})`);
  return worker;
}

function getWorker() {
  return worker;
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

function getRoom(roomId) {
  return rooms.get(roomId);
}

function roomExists(roomId) {
  return rooms.has(roomId);
}

function getRoomPeerCount(roomId) {
  const room = rooms.get(roomId);
  return room ? room.peers.size : 0;
}

function getRoomPeers(roomId) {
  const room = rooms.get(roomId);
  return room ? Array.from(room.peers.keys()) : [];
}

function addPeerToRoom(roomId, peerId) {
  const room = rooms.get(roomId);
  if (!room) throw new Error(`Room ${roomId} not found`);
  room.peers.set(peerId, { id: peerId, joinedAt: Date.now() });
}

function removePeerFromRoom(roomId, peerId) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.peers.delete(peerId);
}

async function createRoom(roomId) {
  if (rooms.has(roomId)) {
    console.log(`[mediasoup] Reusing room: ${roomId}`);
    return rooms.get(roomId);
  }

  console.log(`[mediasoup] Creating room: ${roomId}`);

  const router = await worker.createRouter(CONFIG.router);

  const room = {
    id: roomId,
    router,
    peers: new Map(),
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  console.log(`[mediasoup] Room ${roomId} created (router id: ${router.id})`);

  return room;
}

async function destroyRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  console.log(`[mediasoup] Destroying room: ${roomId}`);

  // Close all peer transports, producers, consumers
  for (const peerId of room.peers.keys()) {
    await clearPeerResources(peerId);
  }

  // Close the router
  room.router.close();
  rooms.delete(roomId);

  console.log(`[mediasoup] Room ${roomId} destroyed`);
}

async function clearPeerResources(peerId) {
  // Close consumers
  const consumerMap = peerConsumers.get(peerId);
  if (consumerMap) {
    for (const consumer of consumerMap.values()) {
      if (!consumer.closed) {
        consumer.close();
      }
    }
    peerConsumers.delete(peerId);
  }

  // Close producers
  const producerMap = peerProducers.get(peerId);
  if (producerMap) {
    for (const producer of producerMap.values()) {
      if (!producer.closed) {
        producer.close();
      }
    }
    peerProducers.delete(peerId);
  }

  // Close transports
  const transports = peerTransports.get(peerId);
  if (transports) {
    if (transports.sendTransport && !transports.sendTransport.closed) {
      transports.sendTransport.close();
    }
    if (transports.recvTransport && !transports.recvTransport.closed) {
      transports.recvTransport.close();
    }
    peerTransports.delete(peerId);
  }
}

// ─── Router Capabilities ─────────────────────────────────────────────────────

function getRouterRtpCapabilities(roomId) {
  const room = rooms.get(roomId);
  if (!room) throw new Error(`Room ${roomId} not found`);
  return room.router.rtpCapabilities;
}

// ─── Transports ──────────────────────────────────────────────────────────────

async function createSendTransport(roomId, peerId) {
  const room = rooms.get(roomId);
  if (!room) throw new Error(`Room ${roomId} not found`);

  const transport = await room.router.createWebRtcTransport(
    CONFIG.webRtcTransport
  );

  let transports = peerTransports.get(peerId);
  if (!transports) {
    transports = {};
    peerTransports.set(peerId, transports);
  }
  transports.sendTransport = transport;

  console.log(
    `[mediasoup] Send transport created for ${peerId} in room ${roomId}`
  );

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

async function createRecvTransport(roomId, peerId) {
  const room = rooms.get(roomId);
  if (!room) throw new Error(`Room ${roomId} not found`);

  const transport = await room.router.createWebRtcTransport(
    CONFIG.webRtcTransport
  );

  let transports = peerTransports.get(peerId);
  if (!transports) {
    transports = {};
    peerTransports.set(peerId, transports);
  }
  transports.recvTransport = transport;

  console.log(
    `[mediasoup] Recv transport created for ${peerId} in room ${roomId}`
  );

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

async function connectSendTransport(peerId, dtlsParameters) {
  const transports = peerTransports.get(peerId);
  if (!transports || !transports.sendTransport) {
    throw new Error(`Send transport not found for peer ${peerId}`);
  }
  await transports.sendTransport.connect({ dtlsParameters });
  console.log(`[mediasoup] Send transport connected for ${peerId}`);
}

async function connectRecvTransport(peerId, dtlsParameters) {
  const transports = peerTransports.get(peerId);
  if (!transports || !transports.recvTransport) {
    throw new Error(`Recv transport not found for peer ${peerId}`);
  }
  await transports.recvTransport.connect({ dtlsParameters });
  console.log(`[mediasoup] Recv transport connected for ${peerId}`);
}

// ─── Producers ───────────────────────────────────────────────────────────────

async function createProducer(peerId, transportId, kind, rtpParameters) {
  const transports = peerTransports.get(peerId);
  if (!transports || !transports.sendTransport) {
    throw new Error(`Send transport not found for peer ${peerId}`);
  }

  const transport = transports.sendTransport;
  if (transport.id !== transportId) {
    throw new Error(`Transport ID mismatch for peer ${peerId}`);
  }

  const producer = await transport.produce({ kind, rtpParameters });

  let producers = peerProducers.get(peerId);
  if (!producers) {
    producers = new Map();
    peerProducers.set(peerId, producers);
  }
  producers.set(producer.id, producer);

  console.log(
    `[mediasoup] Producer created: ${producer.id} (${kind}) by ${peerId}`
  );

  producer.on('transportclose', () => {
    console.log(`[mediasoup] Producer ${producer.id} transport closed`);
    producers.delete(producer.id);
    if (producers.size === 0) {
      peerProducers.delete(peerId);
    }
  });

  return { id: producer.id, kind: producer.kind };
}

function closeProducer(peerId, producerId) {
  const producers = peerProducers.get(peerId);
  if (!producers) return;

  const producer = producers.get(producerId);
  if (producer && !producer.closed) {
    producer.close();
    producers.delete(producerId);
    console.log(`[mediasoup] Producer ${producerId} closed by ${peerId}`);
  }
}

function getPeerProducers(peerId) {
  const producers = peerProducers.get(peerId);
  if (!producers) return [];
  return Array.from(producers.values()).map((p) => ({
    id: p.id,
    kind: p.kind,
  }));
}

function getAllProducersInRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];

  const result = [];
  for (const peerId of room.peers.keys()) {
    const producers = peerProducers.get(peerId);
    if (producers) {
      for (const producer of producers.values()) {
        result.push({
          peerId,
          producerId: producer.id,
          kind: producer.kind,
        });
      }
    }
  }
  return result;
}

// ─── Consumers ───────────────────────────────────────────────────────────────

async function createConsumer(peerId, producerId, rtpCapabilities) {
  // Find the producer
  let targetProducer = null;
  let targetPeerId = null;

  for (const [pid, producers] of peerProducers) {
    if (producers.has(producerId)) {
      targetProducer = producers.get(producerId);
      targetPeerId = pid;
      break;
    }
  }

  if (!targetProducer) {
    throw new Error(`Producer ${producerId} not found`);
  }

  const transports = peerTransports.get(peerId);
  if (!transports || !transports.recvTransport) {
    throw new Error(`Recv transport not found for peer ${peerId}`);
  }

  // Find which room this peer is in
  let roomId = null;
  for (const [rid, room] of rooms) {
    if (room.peers.has(peerId)) {
      roomId = rid;
      break;
    }
  }

  if (!roomId) {
    throw new Error(`Peer ${peerId} not found in any room`);
  }

  const room = rooms.get(roomId);
  if (!room.router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error(`Cannot consume producer ${producerId}`);
  }

  const consumer = await transports.recvTransport.consume({
    producerId,
    rtpCapabilities,
    paused: false,
  });

  let consumers = peerConsumers.get(peerId);
  if (!consumers) {
    consumers = new Map();
    peerConsumers.set(peerId, consumers);
  }
  consumers.set(consumer.id, consumer);

  console.log(
    `[mediasoup] Consumer created: ${consumer.id} -> ${producerId} for ${peerId}`
  );

  consumer.on('transportclose', () => {
    console.log(`[mediasoup] Consumer ${consumer.id} transport closed`);
    consumers.delete(consumer.id);
    if (consumers.size === 0) {
      peerConsumers.delete(peerId);
    }
  });

  consumer.on('producerclose', () => {
    console.log(`[mediasoup] Consumer ${consumer.id} producer closed`);
    consumers.delete(consumer.id);
    if (consumers.size === 0) {
      peerConsumers.delete(peerId);
    }
  });

  return {
    id: consumer.id,
    producerId: consumer.producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
    type: consumer.type,
    producerPaused: consumer.producerPaused,
  };
}

function resumeConsumer(consumerId) {
  // Find the consumer
  for (const consumers of peerConsumers.values()) {
    const consumer = consumers.get(consumerId);
    if (consumer && !consumer.closed) {
      consumer.resume();
      console.log(`[mediasoup] Consumer ${consumerId} resumed`);
      return;
    }
  }
  throw new Error(`Consumer ${consumerId} not found`);
}

function closeConsumer(consumerId) {
  for (const consumers of peerConsumers.values()) {
    const consumer = consumers.get(consumerId);
    if (consumer && !consumer.closed) {
      consumer.close();
      consumers.delete(consumerId);
      console.log(`[mediasoup] Consumer ${consumerId} closed`);
      return;
    }
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  createWorker,
  getWorker,
  createRoom,
  destroyRoom,
  roomExists,
  getRoom,
  getRoomPeerCount,
  getRoomPeers,
  addPeerToRoom,
  removePeerFromRoom,
  clearPeerResources,
  getRouterRtpCapabilities,
  createSendTransport,
  createRecvTransport,
  connectSendTransport,
  connectRecvTransport,
  createProducer,
  closeProducer,
  getPeerProducers,
  getAllProducersInRoom,
  createConsumer,
  resumeConsumer,
  closeConsumer,
};
