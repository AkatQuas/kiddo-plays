/**
 * Web Meeting Client - Entry Point for esbuild bundling
 *
 * Imports mediasoup-client and sets it up for browser use.
 * Socket.io is loaded from CDN as a global.
 */

import * as mediasoupClient from 'mediasoup-client';

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  socket: null,
  device: null,
  roomId: null,
  peerId: null,
  localStream: null,
  sendTransport: null,
  recvTransport: null,
  producers: new Map(),
  consumers: new Map(),
  remoteStreams: new Map(),
  producerToPeer: new Map(),
  peerProducerIds: new Map(),
  peerVideoElements: new Map(),
  micEnabled: true,
  camEnabled: true,
  pendingConsumers: [],
  exiting: false,
};

// ─── DOM References ──────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const videoGrid = $('videoGrid');
const localVideo = $('localVideo');
const localVideoContainer = $('localVideoContainer');
const localVideoDot = $('localVideoDot');
const toastContainer = $('toastContainer');
const loadingOverlay = $('loadingOverlay');
const loadingStep = $('loadingStep');
const connectionStatus = $('connectionStatus');
const roomIdDisplay = $('roomIdDisplay');
const peerCountDisplay = $('peerCountDisplay');
const micBtn = $('micBtn');
const camBtn = $('camBtn');

// ─── Toast ───────────────────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 3000) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  toastContainer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, duration);
}

// ─── Room ID Helpers ─────────────────────────────────────────────────────────

function getRoomIdFromUrl() {
  return new URLSearchParams(window.location.search).get('roomId');
}

function copyRoomId() {
  if (state.roomId) {
    navigator.clipboard
      .writeText(state.roomId)
      .then(() => {
        showToast('房间号已复制: ' + state.roomId, 'success');
      })
      .catch(() => {
        showToast('复制失败，请手动复制', 'error');
      });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SOCKET & SIGNALING
// ═══════════════════════════════════════════════════════════════════════════════

function setupSocket() {
  const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // // 拦截客户端发出的所有消息
  // const originEmit = socket.emit;
  // socket.emit = function (event, ...args) {
  //   console.log('[CLIENT SEND]', event, args);
  //   return originEmit.call(this, event, ...args);
  // };

  // // 拦截所有服务端推送过来的消息
  // const originOn = socket.on;
  // socket.on = function (event, cb) {
  //   return originOn.call(this, event, (...args) => {
  //     console.log('[CLIENT RECV]', event, args);
  //     cb(...args);
  //   });
  // };

  state.socket = socket;

  socket.on('connect', () => {
    console.log('[socket] Connected');
    updateConnectionStatus('connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('[socket] Disconnected:', reason);
    updateConnectionStatus('connecting');
    showToast('网络连接断开，正在重连...', 'error', 0);
  });

  socket.on('reconnect', () => {
    updateConnectionStatus('connected');
    showToast('重新连接成功', 'success');
  });

  socket.on('connect_error', (err) => {
    console.error('[socket] Connection error:', err.message);
  });

  // ── roomJoined ─────────────────────────────────────────────────────────
  socket.on('roomJoined', async (data) => {
    state.roomId = data.roomId;
    state.peerId = data.peerId;
    roomIdDisplay.textContent = data.roomId;
    updatePeerCount(data.peers.length + 1, data.maxPeers);
    setLoadingStep('正在初始化媒体设备...');

    // 记录房间内其他用户的 producer 信息（等 recvTransport 就绪后消费）
    if (data.producers && data.producers.length > 0) {
      console.log(
        `[room] ${data.producers.length} existing producer(s) in room`
      );
      for (const prod of data.producers) {
        // 建立 producer → peer 映射
        state.producerToPeer.set(prod.producerId, prod.peerId);
        if (!state.peerProducerIds.has(prod.peerId)) {
          state.peerProducerIds.set(prod.peerId, new Set());
        }
        state.peerProducerIds.get(prod.peerId).add(prod.producerId);

        if (!state.remoteStreams.has(prod.peerId)) {
          state.remoteStreams.set(prod.peerId, new MediaStream());
        }

        // 等 recvTransport 创建后消费
        state.pendingConsumers.push({
          peerId: prod.peerId,
          producerId: prod.producerId,
        });
      }
    }

    await initializeMedia();
  });

  // ── newPeer ────────────────────────────────────────────────────────────
  socket.on('newPeer', ({ peerId }) => {
    console.log('[room] New peer:', peerId);
    if (!state.remoteStreams.has(peerId)) {
      state.remoteStreams.set(peerId, new MediaStream());
    }
    showToast(`用户 ${peerId.slice(0, 6)} 加入了房间`, 'info');
  });

  // ── peerLeft ───────────────────────────────────────────────────────────
  socket.on('peerLeft', ({ peerId }) => {
    console.log('[room] Peer left:', peerId);
    showToast(`用户 ${peerId.slice(0, 6)} 离开了房间`, 'info');
    removeRemoteVideo(peerId);
  });

  // ── peerCountChanged ───────────────────────────────────────────────────
  socket.on('peerCountChanged', ({ count, max }) => {
    updatePeerCount(count, max);
  });

  // ── routerRtpCapabilities ──────────────────────────────────────────────
  socket.on('routerRtpCapabilities', async ({ rtpCapabilities }) => {
    setLoadingStep('正在建立媒体连接...');
    await initDevice(rtpCapabilities);
  });

  // ── sendTransportCreated ───────────────────────────────────────────────
  socket.on('sendTransportCreated', (params) => {
    setLoadingStep('正在创建上行通道...');
    createSendTransport(params);
    // 立刻推流，不等待 connect（transport.produce() 会在内部排队等待底层就绪）
    produceMedia();
  });

  // ── sendTransportConnected ─────────────────────────────────────────────
  socket.on('sendTransportConnected', () => {
    console.log('[transport] Send transport connected');
    // 不再在此处调 produceMedia()，sendTransportCreated 已经调过一次了
    // transport.produce() 内部会等待 connect callback 完成后再触发 produce 事件
  });

  // ── recvTransportCreated ───────────────────────────────────────────────
  socket.on('recvTransportCreated', (params) => {
    setLoadingStep('正在创建下行通道...');
    createRecvTransport(params);
    // 立即消费已有远端流，transport.consume() 不需要连接完成
    processPendingConsumers();
    hideLoading();
  });

  // ── produced ───────────────────────────────────────────────────────────
  socket.on('produced', ({ id, kind }) => {
    console.log(`[produce] ${kind} produced: ${id}`);
    hideLoading();
  });

  // ── consumed ───────────────────────────────────────────────────────────
  socket.on('consumed', async (data) => {
    await handleConsumed(data);
  });

  // ── newProducer ────────────────────────────────────────────────────────
  socket.on('newProducer', async ({ peerId, producerId, kind }) => {
    console.log(`[producer] New ${kind} producer ${producerId} from ${peerId}`);

    state.producerToPeer.set(producerId, peerId);
    if (!state.peerProducerIds.has(peerId)) {
      state.peerProducerIds.set(peerId, new Set());
    }
    state.peerProducerIds.get(peerId).add(producerId);

    if (!state.remoteStreams.has(peerId)) {
      state.remoteStreams.set(peerId, new MediaStream());
    }

    requestConsume(peerId, producerId);
  });

  // ── producerClosed ─────────────────────────────────────────────────────
  socket.on('producerClosed', ({ peerId, producerId }) => {
    console.log(`[producer] Producer closed: ${producerId}`);
    handleProducerClosed(peerId, producerId);
  });

  // ── error ──────────────────────────────────────────────────────────────
  socket.on('error', ({ message }) => {
    console.error('[socket] Error:', message);
    showToast(message, 'error');
    hideLoading();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

// ---- 每轮初始化使用独立的 Promise，避免跨房间复用 ----

let _resolveDeviceReady = null;

function makeDeviceReadyPromise() {
  return new Promise((resolve) => {
    _resolveDeviceReady = resolve;
  });
}

async function initializeMedia() {
  try {
    // 1. 获取 Router RTP Capabilities（等待 socket 事件触发 initDevice）
    setLoadingStep('正在建立媒体连接...');
    state.socket.emit('getRouterRtpCapabilities', { roomId: state.roomId });

    // 2. 等待 device 初始化完成（来自 routerRtpCapabilities socket 事件）
    await makeDeviceReadyPromise();
    if (!state.device) {
      throw new Error('媒体设备初始化失败');
    }
    console.log('[init] Device ready, starting local media');

    // 3. 启动本地摄像头/麦克风
    setLoadingStep('正在获取摄像头和麦克风权限...');
    await startLocalMedia();

    // 4. 确保 device 加载完成后，再创建 Send/Recv Transport
    setLoadingStep('正在建立上行通道...');
    state.socket.emit('createSendTransport', { roomId: state.roomId });
    state.socket.emit('createRecvTransport', { roomId: state.roomId });

    console.log('[init] Transports requested');

    // 安全兜底：8 秒后无论如何隐藏加载蒙层
    setTimeout(hideLoading, 8000);
  } catch (error) {
    console.error('[init] Error:', error);
    showToast('初始化失败: ' + error.message, 'error');
    hideLoading();
  }
}

async function startLocalMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30 },
      },
    });

    state.localStream = stream;
    localVideo.srcObject = stream;
    state.micEnabled = true;
    state.camEnabled = true;
    updateMicButton(true);
    updateCamButton(true);
    localVideoDot.className = 'status-dot active';
    console.log('[media] Local media started');
  } catch (error) {
    console.error('[media] Error getting media:', error);
    $('permissionError').style.display = 'flex';
    hideLoading();
    throw error;
  }
}

function stopLocalMedia() {
  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => track.stop());
    state.localStream = null;
  }
  localVideo.srcObject = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MEDIASOUP CLIENT DEVICE
// ═══════════════════════════════════════════════════════════════════════════════

async function initDevice(rtpCapabilities) {
  try {
    const device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
    state.device = device;
    console.log('[device] Loaded successfully');
    // 通知 initializeMedia 可以继续了
    if (_resolveDeviceReady) {
      _resolveDeviceReady();
      _resolveDeviceReady = null;
    }
  } catch (error) {
    console.error('[device] Error loading:', error);
    showToast('初始化媒体设备失败', 'error');
    // 即使失败也要 resolve，避免死等
    if (_resolveDeviceReady) {
      _resolveDeviceReady();
      _resolveDeviceReady = null;
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TRANSPORTS
// ═══════════════════════════════════════════════════════════════════════════════

function createSendTransport(params) {
  if (!state.device) {
    console.error(
      '[transport] Device not ready - cannot create send transport'
    );
    showToast('设备未就绪，无法创建上行通道', 'error');
    return;
  }

  const transport = state.device.createSendTransport(params);
  state.sendTransport = transport;

  transport.on('connect', ({ dtlsParameters }, callback, errback) => {
    console.log('[transport] Send transport connect');
    state.socket.emit('connectSendTransport', { dtlsParameters });
    state.socket.once('sendTransportConnected', () => callback());
    state.socket.once('error', (err) => {
      console.error('[transport] Send connect error:', err);
      errback?.(err);
    });
    setTimeout(() => callback(), 10000);
  });

  transport.on('produce', ({ kind, rtpParameters }, callback) => {
    console.log(`[transport] Produce ${kind}`);
    state.socket.emit('produce', {
      transportId: transport.id,
      kind,
      rtpParameters,
    });
    state.socket.once('produced', ({ id }) => {
      callback({ id });
      console.log(`[produce] ${kind} produced: ${id}`);
    });
    setTimeout(() => callback({ id: kind + '-' + Date.now() }), 10000);
  });

  transport.on('connectionstatechange', (s) => {
    console.log('[transport] Send transport state:', s);
    if (s === 'failed') showToast('上行连接异常', 'error');
  });

  console.log('[transport] Send transport created');
}

function createRecvTransport(params) {
  if (!state.device) {
    console.error(
      '[transport] Device not ready - cannot create recv transport'
    );
    showToast('设备未就绪，无法创建下行通道', 'error');
    return;
  }

  const transport = state.device.createRecvTransport(params);
  state.recvTransport = transport;

  transport.on('connect', ({ dtlsParameters }, callback, errback) => {
    console.log('[transport] Recv transport connect');
    state.socket.emit('connectRecvTransport', { dtlsParameters });
    state.socket.once('recvTransportConnected', () => callback());
    state.socket.once('error', (err) => {
      console.error('[transport] Recv connect error:', err);
      errback?.(err);
    });
    setTimeout(() => callback(), 10000);
  });

  transport.on('connectionstatechange', (s) => {
    console.log('[transport] Recv transport state:', s);
  });

  console.log('[transport] Recv transport created');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCE
// ═══════════════════════════════════════════════════════════════════════════════

async function produceMedia() {
  if (!state.sendTransport || !state.localStream) {
    console.warn('[produce] Transport or stream not ready');
    return;
  }

  // transport.produce() 在 transport 未连接时返回一个 Promise<Producer>，需要 await
  // mediasoup-client 会在内部等待 connect callback 完成后再真正创建 Producer

  const audioTrack = state.localStream.getAudioTracks()[0];
  if (audioTrack && !state.producers.has('audio')) {
    try {
      const result = state.sendTransport.produce({ track: audioTrack });
      // produce() 可能返回 Promise（connect 未完成时）或直接返回 Producer
      const producer = result instanceof Promise ? await result : result;
      if (producer && typeof producer.on === 'function') {
        state.producers.set('audio', producer);
        producer.on('transportclose', () => state.producers.delete('audio'));
        console.log('[produce] Audio produced:', producer.id);
      } else {
        console.warn('[produce] Audio producer invalid:', producer);
      }
    } catch (e) {
      console.error('[produce] Audio error:', e);
    }
  }

  const videoTrack = state.localStream.getVideoTracks()[0];
  if (videoTrack && !state.producers.has('video')) {
    try {
      const result = state.sendTransport.produce({ track: videoTrack });
      const producer = result instanceof Promise ? await result : result;
      if (producer && typeof producer.on === 'function') {
        state.producers.set('video', producer);
        producer.on('transportclose', () => state.producers.delete('video'));
        console.log('[produce] Video produced:', producer.id);
      } else {
        console.warn('[produce] Video producer invalid:', producer);
      }
    } catch (e) {
      console.error('[produce] Video error:', e);
    }
  }

  hideLoading();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSUME
// ═══════════════════════════════════════════════════════════════════════════════

function requestConsume(peerId, producerId) {
  for (const [, data] of state.consumers) {
    if (data.producerId === producerId) return;
  }

  if (!state.recvTransport) {
    state.pendingConsumers.push({ peerId, producerId });
    return;
  }

  doConsume(peerId, producerId);
}

function processPendingConsumers() {
  const pending = state.pendingConsumers.slice();
  state.pendingConsumers = [];
  for (const { peerId, producerId } of pending) {
    doConsume(peerId, producerId);
  }
}

function doConsume(peerId, producerId) {
  if (!state.device || !state.recvTransport) return;
  state.socket.emit('consume', {
    producerId,
    rtpCapabilities: state.device.rtpCapabilities,
  });
}

async function handleConsumed(data) {
  try {
    const consumer = await state.recvTransport.consume({
      id: data.id,
      producerId: data.producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });

    await consumer.resume();
    state.socket.emit('resumeConsumer', { consumerId: data.id });

    const peerId = state.producerToPeer.get(data.producerId);

    state.consumers.set(data.id, {
      consumer,
      producerId: data.producerId,
      peerId,
      kind: data.kind,
    });

    if (peerId) {
      if (!state.remoteStreams.has(peerId)) {
        state.remoteStreams.set(peerId, new MediaStream());
      }
      const stream = state.remoteStreams.get(peerId);
      stream.addTrack(consumer.track);

      if (data.kind === 'video') {
        renderRemoteVideo(peerId, stream);
      }
    }

    console.log(
      `[consume] ${data.kind} consumer ${data.id} -> peer ${peerId ? peerId.slice(0, 6) : '?'}`
    );

    consumer.on('producerclose', () => {
      console.log(`[consume] Producer closed: ${data.id}`);
      if (peerId) {
        const stream = state.remoteStreams.get(peerId);
        if (stream) {
          const tracks = stream.getTracks().filter((t) => t.kind === data.kind);
          tracks.forEach((t) => {
            stream.removeTrack(t);
            t.stop();
          });
        }
      }
      state.consumers.delete(data.id);
    });
  } catch (error) {
    console.error('[consume] Error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  REMOTE VIDEO RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

function renderRemoteVideo(peerId, stream) {
  if (state.peerVideoElements.has(peerId)) {
    const existing = state.peerVideoElements.get(peerId);
    existing.video.srcObject = stream;
    existing.container.classList.remove('muted-video');
    return;
  }

  const container = document.createElement('div');
  container.className = 'video-container';
  container.dataset.peerId = peerId;

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;

  // 检测远端流是否确实获得视频数据
  video.onloadedmetadata = () => {
    console.log(
      '[video] Remote stream loaded, tracks:',
      stream.getTracks().length
    );
  };
  video.onresize = () => {
    console.log(
      '[video] Remote video dimensions:',
      video.videoWidth,
      'x',
      video.videoHeight
    );
  };

  const label = document.createElement('div');
  label.className = 'video-label';
  label.innerHTML = `
    <span class="status-dot active" id="remoteDot-${peerId}"></span>
    <span>用户 ${peerId.slice(0, 6)}</span>
  `;

  container.appendChild(video);
  container.appendChild(label);
  videoGrid.appendChild(container);

  // 挂载后再设 srcObject（autoplay + muted 让浏览器自动播放视频帧）
  video.srcObject = stream;

  // 显式 play() 可能在 stream 加载流期间被中断，setTimeout 推迟到下一帧再执行
  setTimeout(() => {
    video.play().catch((e) => {
      if (e.name === 'NotAllowedError') {
        console.warn('[video] autoplay blocked, will retry muted');
        video.muted = true;
        video.play().catch(() => {
          // 加一次点击事件兜底
          document.addEventListener('click', () => video.play(), {
            once: true,
          });
        });
      }
      console.debug('\x1B[97;100;1m --- video play error --- \x1B[m', '\n', e);
    });
  }, 200);

  state.peerVideoElements.set(peerId, { container, video, label });
  updateGridLayout();

  console.log('[video] Container created, srcObject set, play scheduled');
}

function removeRemoteVideo(peerId) {
  const existing = state.peerVideoElements.get(peerId);
  if (existing) {
    existing.container.remove();
    state.peerVideoElements.delete(peerId);
    updateGridLayout();
  }

  const stream = state.remoteStreams.get(peerId);
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    state.remoteStreams.delete(peerId);
  }

  state.peerProducerIds.delete(peerId);

  for (const [cid, cdata] of state.consumers) {
    if (cdata.peerId === peerId) {
      cdata.consumer.close();
      state.consumers.delete(cid);
    }
  }

  for (const [pid, pidPeerId] of state.producerToPeer) {
    if (pidPeerId === peerId) state.producerToPeer.delete(pid);
  }
}

function handleProducerClosed(peerId, producerId) {
  state.producerToPeer.delete(producerId);
  const producerIds = state.peerProducerIds.get(peerId);
  if (producerIds) producerIds.delete(producerId);

  for (const [cid, cdata] of state.consumers) {
    if (cdata.producerId === producerId) {
      cdata.consumer.close();
      state.consumers.delete(cid);
      break;
    }
  }
}

function updateGridLayout() {
  // 总视频数 = 本地 + 远端
  const total = 1 + state.peerVideoElements.size;
  videoGrid.className = '';
  videoGrid.classList.add(`total-${Math.min(total, 4)}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  UI UPDATES
// ═══════════════════════════════════════════════════════════════════════════════

function updatePeerCount(current, max) {
  peerCountDisplay.textContent = `${current}/${max}`;
}

function updateConnectionStatus(status) {
  connectionStatus.className = `connection-status ${status}`;
  connectionStatus.textContent =
    status === 'connected'
      ? '已连接'
      : status === 'connecting'
        ? '连接中...'
        : '已断开';
}

function updateMicButton(enabled) {
  micBtn.className = `control-btn ${enabled ? 'active' : 'inactive'}`;
}

function updateCamButton(enabled) {
  camBtn.className = `control-btn ${enabled ? 'active' : 'inactive'}`;
  localVideoContainer.classList.toggle('muted-video', !enabled);
  localVideoDot.className = `status-dot ${enabled ? 'active' : 'inactive'}`;
}

function setLoadingStep(text) {
  loadingStep.textContent = text;
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
  setTimeout(() => (loadingOverlay.style.display = 'none'), 500);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DEVICE CONTROLS
// ═══════════════════════════════════════════════════════════════════════════════

window.toggleMic = function () {
  const audioTrack = state.localStream?.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;
  updateMicButton(audioTrack.enabled);
  showToast(audioTrack.enabled ? '麦克风已开启' : '麦克风已关闭', 'info');
};

window.toggleCam = function () {
  const videoTrack = state.localStream?.getVideoTracks()[0];
  if (!videoTrack) return;
  videoTrack.enabled = !videoTrack.enabled;
  updateCamButton(videoTrack.enabled);
  showToast(videoTrack.enabled ? '摄像头已开启' : '摄像头已关闭', 'info');
};

window.leaveRoom = function () {
  if (state.exiting) return;
  state.exiting = true;

  showToast('正在退出房间...', 'info', 0);

  for (const [, cdata] of state.consumers) {
    try {
      cdata.consumer.close();
    } catch (e) {}
  }
  state.consumers.clear();

  for (const [, producer] of state.producers) {
    try {
      producer.close();
    } catch (e) {}
  }
  state.producers.clear();

  if (state.sendTransport) {
    try {
      state.sendTransport.close();
    } catch (e) {}
    state.sendTransport = null;
  }
  if (state.recvTransport) {
    try {
      state.recvTransport.close();
    } catch (e) {}
    state.recvTransport = null;
  }

  stopLocalMedia();
  state.socket.emit('leaveRoom');
  state.socket.disconnect();
  window.location.href = '/';
};

window.copyRoomId = copyRoomId;

// ═══════════════════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const roomId = getRoomIdFromUrl();
  if (!roomId) {
    window.location.href = '/';
    return;
  }

  roomIdDisplay.textContent = roomId;
  state.roomId = roomId;

  setLoadingStep('正在加入房间...');
  setupSocket();
  state.socket.emit('joinRoom', { roomId });
});
