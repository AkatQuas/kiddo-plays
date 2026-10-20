import { EventEmitter } from 'node:events';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { MSG } from './protocol.js';
import config from './config.js';

const RECONNECT_MS = 2000;

// Mesh of socket.io connections between peers. Each device both listens
// (Server) and dials every other peer (socket.io-client). Whichever socket
// completes HELLO first for a given peer name is usable; duplicates may
// exist but sendTo picks any connected one.
export default class Network extends EventEmitter {
  constructor() {
    super();
    this.peers = new Map(); // deviceName -> Set<socket>
    this.outbound = new Map(); // deviceName -> client socket
  }

  start() {
    this.server = new Server(config.port, {
      // LAN peers only — no browser CORS concerns, but allow all origins
      // so mixed-OS clients connect without fuss.
      cors: { origin: '*' },
      transports: ['websocket'],
      allowEIO3: false,
    });

    this.server.on('connection', (socket) => {
      const addr = socket.handshake.address;
      console.log(`[net] incoming connection from ${addr}`);
      this.setupSocket(socket);
      this.sendHello(socket);
    });

    console.log(`[net] listening on :${config.port}`);

    for (const d of config.devices) {
      if (d.name === config.selfName) continue;
      this.connectToPeer(d);
    }
  }

  connectToPeer(device) {
    const existing = this.outbound.get(device.name);
    if (existing) {
      existing.removeAllListeners();
      existing.close();
    }

    const url = `http://${device.host}:${device.port}`;
    const socket = ioClient(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: RECONNECT_MS,
      reconnectionDelayMax: RECONNECT_MS * 5,
      timeout: 5000,
    });
    this.outbound.set(device.name, socket);

    socket.on('connect', () => {
      console.log(`[net] dialed ${device.name} (${url})`);
      this.sendHello(socket);
    });
    socket.on('connect_error', (err) => {
      // Noisy during boot while peers come online — keep quiet after first.
      if (!socket._rmLoggedErr) {
        console.log(`[net] waiting for ${device.name}: ${err.message}`);
        socket._rmLoggedErr = true;
      }
    });
    socket.on('disconnect', () => {
      this.removeSocket(socket);
    });

    this.setupSocket(socket);
  }

  setupSocket(socket) {
    socket.on('hello', (msg) => {
      if (!msg || typeof msg.device !== 'string') return;
      socket._peerName = msg.device;
      if (!this.peers.has(msg.device)) this.peers.set(msg.device, new Set());
      this.peers.get(msg.device).add(socket);
      console.log(`[net] peer "${msg.device}" registered`);
      this.emit('peer-up', msg.device);
    });

    socket.on('message', (msg) => {
      if (!msg || typeof msg.type !== 'string') return;
      this.emit('message', msg, socket._peerName);
    });

    socket.on('disconnect', () => this.removeSocket(socket));
  }

  removeSocket(socket) {
    const name = socket._peerName;
    if (!name) return;
    const set = this.peers.get(name);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) {
      this.peers.delete(name);
      console.log(`[net] peer "${name}" lost`);
      this.emit('peer-down', name);
    }
  }

  sendHello(socket) {
    try {
      socket.emit('hello', { type: MSG.HELLO, device: config.selfName });
    } catch {
      /* not connected */
    }
  }

  sendTo(name, msg) {
    const set = this.peers.get(name);
    if (!set) return false;
    for (const socket of set) {
      if (socket.connected) {
        socket.emit('message', msg);
        return true;
      }
    }
    return false;
  }

  broadcast(msg) {
    for (const set of this.peers.values()) {
      for (const socket of set) {
        if (socket.connected) socket.emit('message', msg);
      }
    }
  }
}
