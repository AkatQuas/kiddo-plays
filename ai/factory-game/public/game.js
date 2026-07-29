// ============================================================
// 工厂模拟游戏 · 客户端
// Canvas 渲染 + Socket.IO + 建造面板
// 纯原生 JS，无编译环节
// ============================================================

// ──── 状态 ────
const S = {
  world: null, meta: null, socket: null, mode: null,
  hoverTile: null,
  camera: { offsetX: 0, offsetY: 0, zoom: 1 },
  CELL: 64, PANEL_W: 180, HUD_H: 36, STATUS_H: 28,
  drag: { active: false, startX: 0, startY: 0, camX: 0, camY: 0 },
};

// ──── WebSocket (socket.io) ────
function connectWS() {
  const socket = io();
  S.socket = socket;
  socket.on("message", (data) => {
    const msg = JSON.parse(data);
    if (msg.type === "state") {
      S.world = msg.world;
      updateHUD();
    } else if (msg.type === "agent_log") {
      appendLog(msg.tag, msg.msg);
    }
  });
}

function send(msg) {
  if (S.socket?.connected) S.socket.emit("message", JSON.stringify(msg));
}

// ──── Agent 日志流 ────
let _currentTurnEl = null;
let _thinkingTimer = null;

function appendLog(tag, msg) {
  const body = document.getElementById('logBody');
  if (!body) return;

  // 回合开始 → 创建新分组
  if (tag === 'turn') {
    if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
    _currentTurnEl = document.createElement('div');
    _currentTurnEl.className = 'log-turn ' + (msg.includes('工厂') ? 'factory' : 'customer');
    const header = document.createElement('div');
    header.className = 'log-turn-header';
    header.textContent = msg;
    _currentTurnEl.appendChild(header);
    const content = document.createElement('div');
    content.className = 'log-turn-content';
    _currentTurnEl.appendChild(content);
    body.appendChild(_currentTurnEl);
    while (body.children.length > 50) body.removeChild(body.firstChild);
    body.scrollTop = body.scrollHeight;
    return;
  }

  // 思考中 → loading 动画
  if (tag === 'system' && msg.includes('思考')) {
    if (_currentTurnEl) {
      const content = _currentTurnEl.querySelector('.log-turn-content');
      if (content) {
        let dots = 0;
        const loading = document.createElement('div');
        loading.className = 'log-entry loading';
        loading.textContent = '⏳ 思考中';
        content.appendChild(loading);
        if (_thinkingTimer) clearInterval(_thinkingTimer);
        _thinkingTimer = setInterval(() => {
          dots = (dots + 1) % 4;
          loading.textContent = '⏳ 思考中' + '.'.repeat(dots);
        }, 500);
      }
    }
    return;
  }

  // 完成 → 清除 loading
  if (tag === 'system' && msg.includes('完成')) {
    if (_thinkingTimer) { clearInterval(_thinkingTimer); _thinkingTimer = null; }
    if (_currentTurnEl) {
      const loading = _currentTurnEl.querySelector('.loading');
      if (loading) loading.remove();
    }
    return;
  }

  // 常规日志 → 追加到当前回合
  if (_currentTurnEl) {
    const content = _currentTurnEl.querySelector('.log-turn-content');
    if (content) {
      const div = document.createElement('div');
      div.className = 'log-entry ' + tag;
      div.textContent = msg;
      content.appendChild(div);
      body.scrollTop = body.scrollHeight;
      return;
    }
  }
}

// ──── DOM 引用 ────
const $ = (s) => document.querySelector(s);
const canvas = $('#gameCanvas');
const ctx = canvas.getContext('2d');

// ──── 坐标转换 ────
function toScreenX(tx) { return S.camera.offsetX + tx * S.CELL * S.camera.zoom; }
function toScreenY(ty) { return S.camera.offsetY + ty * S.CELL * S.camera.zoom; }
function toTileX(sx) { return Math.floor((sx - S.camera.offsetX) / (S.CELL * S.camera.zoom)); }
function toTileY(sy) { return Math.floor((sy - S.camera.offsetY) / (S.CELL * S.camera.zoom)); }
function cellSize() { return S.CELL * S.camera.zoom; }

// ──── 初始化 ────
async function boot() {
  S.meta = await (await fetch('/api/meta')).json();
  buildPalette();
  connectWS();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); onRightClick(); });
  canvas.addEventListener('wheel', onWheel, { passive: false });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancelMode();
    if (e.key === 'r' || e.key === 'R') rotateFacing();
  });

  $('#hudSpeed').onchange = () => {
    const speed = parseInt($('#hudSpeed').value) || 2;
    send({ type: 'set_speed', speed });
  };
  $('#hudPause').onclick = () => send({ type: 'toggle_pause' });
  $('#questBtn').onclick = openQuest;
  $('#questClose').onclick = closeQuest;
  $('#resetBtn').onclick = () => {
    if (confirm('确认重置所有进度？')) send({ type: 'reset' });
  };

  requestAnimationFrame(render);
}

// ──── Canvas 尺寸 & 相机 ────
function resizeCanvas() {
  canvas.width = window.innerWidth - S.PANEL_W;
  canvas.height = window.innerHeight - S.HUD_H - 28 - S.STATUS_H;
  if (S.meta) {
    if (!S._inited) {
      S._inited = true;
      const gridW = S.meta.width * S.CELL;
      const gridH = S.meta.height * S.CELL;
      S.camera.offsetX = Math.max(0, (canvas.width - gridW) / 2);
      S.camera.offsetY = Math.max(0, (canvas.height - gridH) / 2);
    }
  }
}

function clampCamera() {
  if (!S.world) return;
  const cw = canvas.width, ch = canvas.height;
  const gw = S.world.width * S.CELL * S.camera.zoom;
  const gh = S.world.height * S.CELL * S.camera.zoom;
  const maxOffX = Math.max(0, gw - cw);
  const maxOffY = Math.max(0, gh - ch);
  if (gw <= cw) S.camera.offsetX = (cw - gw) / 2;
  else S.camera.offsetX = Math.min(0, Math.max(-maxOffX, S.camera.offsetX));
  if (gh <= ch) S.camera.offsetY = (ch - gh) / 2;
  else S.camera.offsetY = Math.min(0, Math.max(-maxOffY, S.camera.offsetY));
}

// ──── 鼠标交互 ────
function onMouseDown(e) {
  if (e.button === 0 && !S.mode) {
    S.drag.active = true;
    S.drag.startX = e.clientX;
    S.drag.startY = e.clientY;
    S.drag.camX = S.camera.offsetX;
    S.drag.camY = S.camera.offsetY;
    canvas.style.cursor = 'grabbing';
  }
}

function onMouseMove(e) {
  if (S.drag.active) {
    const dx = e.clientX - S.drag.startX;
    const dy = e.clientY - S.drag.startY;
    S.camera.offsetX = S.drag.camX + dx;
    S.camera.offsetY = S.drag.camY + dy;
    clampCamera();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  S.hoverTile = { x: toTileX(mx), y: toTileY(my) };
  if (S.hoverTile && S.world) {
    const key = `${S.hoverTile.x},${S.hoverTile.y}`;
    const tile = S.world.tiles[key];
    if (tile?.machineId) {
      const m = S.meta?.machines[tile.machineId];
      setStatus(`(${S.hoverTile.x}, ${S.hoverTile.y}) ${m?.label || tile.machineId}${tile.progress != null ? ` 加工中 ${Math.round(tile.progress * 100)}%` : ''}`);
    } else if (tile?.beltDir) {
      const dirs = { n: '↑', s: '↓', e: '→', w: '←' };
      setStatus(`(${S.hoverTile.x}, ${S.hoverTile.y}) 传送带 ${dirs[tile.beltDir] || tile.beltDir} 物品:${tile.beltItems?.length || 0}`);
    } else {
      setStatus(`(${S.hoverTile.x}, ${S.hoverTile.y})`);
    }
  }
}

function onMouseUp() {
  if (S.drag.active) {
    S.drag.active = false;
    canvas.style.cursor = S.mode ? 'crosshair' : 'default';
  }
}

function onWheel(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const wx = (mx - S.camera.offsetX) / S.camera.zoom;
  const wy = (my - S.camera.offsetY) / S.camera.zoom;
  const delta = e.deltaY < 0 ? 0.15 : -0.15;
  S.camera.zoom = Math.max(0.25, Math.min(4, S.camera.zoom + delta));
  S.camera.offsetX = mx - wx * S.camera.zoom;
  S.camera.offsetY = my - wy * S.camera.zoom;
  clampCamera();
}

function onClick(e) {
  if (!S.hoverTile || !S.world) return;
  if (S.drag.active) return;
  const { x, y } = S.hoverTile;
  if (x < 0 || x >= S.world.width || y < 0 || y >= S.world.height) return;

  if (S.mode === 'belt') {
    send({ type: 'place_belt', x, y, dir: S._beltDir || 'e' });
  } else if (S.mode === 'corner') {
    send({ type: 'place_belt', x, y, dir: S._beltDir || 'e', beltEntry: S._beltEntry || 'w' });
  } else if (S.mode === '__preset__') {
    send({ type: 'place_preset', presetId: S._presetId, x, y });
    cancelMode();
  } else if (S.mode === '__remove__') {
    send({ type: 'remove_tile', x, y });
  } else if (S.mode) {
    send({ type: 'place_machine', x, y, machineId: S.mode, facing: S._facing || 'e' });
  }
  S.drag.active = false;
}

function onRightClick() {
  if (S.hoverTile) send({ type: 'remove_tile', x: S.hoverTile.x, y: S.hoverTile.y });
}

function cancelMode() {
  S.mode = null;
  S._facing = 'e';
  S._beltDir = 'e';
  document.querySelectorAll('.palette-item').forEach((x) => x.classList.remove('active'));
  setStatus('点击右侧面板选择要建造的机器或传送带');
}

function rotateFacing() {
  if (!S.mode || S.mode === 'belt') return;
  const dirs = ['e', 's', 'w', 'n'];
  S._facing = dirs[(dirs.indexOf(S._facing || 'e') + 1) % 4];
  setStatus(`方向: ${({ e: '→', s: '↓', w: '←', n: '↑' })[S._facing]}（R 键旋转）`);
}

function setStatus(text) { $('#statusText').textContent = text; }

// ──── 建造面板 ────
async function buildPalette() {
  const body = $('#paletteBody');
  let html = '';

  html += `<div class="palette-cat">🔧 工具</div>`;
  html += `<div class="palette-item" data-id="__remove__">
    <span class="preview" style="background:#cc3333">🗑</span>
    <span class="name">回收</span>
    <span class="size">返还一半</span>
  </div>`;

  html += `<div class="palette-cat">🔧 基础设施</div>`;
  for (const dir of [{ id: 'belt_e', label: '传送带→', dir: 'e', cost:'铁矿8+铜矿8' }, { id: 'belt_n', label: '传送带↑', dir: 'n', cost:'铁矿8+铜矿8' }, { id: 'belt_w', label: '传送带←', dir: 'w', cost:'铁矿8+铜矿8' }, { id: 'belt_s', label: '传送带↓', dir: 's', cost:'铁矿8+铜矿8' }]) {
    html += `<div class="palette-item" data-id="${dir.id}" data-dir="${dir.dir}">
      <span class="preview" style="background:#555">➡</span>
      <span class="name">${dir.label}</span>
      <span class="size">${dir.cost}</span>
    </div>`;
  }
  for (const corner of [
    { entry:'w', dir:'s', label:'弯头→↓', icon:'↘' },
    { entry:'w', dir:'n', label:'弯头→↑', icon:'↗' },
    { entry:'e', dir:'s', label:'弯头←↓', icon:'↙' },
    { entry:'e', dir:'n', label:'弯头←↑', icon:'↖' },
  ]) {
    html += `<div class="palette-item" data-id="corner" data-dir="${corner.dir}" data-entry="${corner.entry}">
      <span class="preview" style="background:#3a3a5e">${corner.icon}</span>
      <span class="name">${corner.label}</span>
      <span class="size">铁矿8+铜矿8</span>
    </div>`;
  }

  const presets = await (await fetch('/api/presets')).json();
  if (presets.length) {
    html += `<div class="palette-cat">🏗 预制产线</div>`;
    for (const p of presets) {
      const costParts = [];
      if (p.cost.money) costParts.push(`¥${p.cost.money}`);
      if (p.cost.items?.iron_ore) costParts.push(`铁${p.cost.items.iron_ore}`);
      if (p.cost.items?.copper_ore) costParts.push(`铜${p.cost.items.copper_ore}`);
      html += `<div class="palette-item preset" data-preset="${p.id}">
        <span class="preview" style="background:#2a5a2a">🏭</span>
        <span class="name">${p.label}</span>
        <span class="size">${costParts.join('+')}</span>
      </div>`;
    }
  }

  for (const cat of S.meta.categories) {
    html += `<div class="palette-cat">${cat.label}</div>`;
    for (const mid of cat.items) {
      const m = S.meta.machines[mid];
      if (!m) continue;
      const cost = m.cost?.money ? `¥${m.cost.money}` : '';
      const size = m.size.w > 1 || m.size.h > 1 ? ` ${m.size.w}×${m.size.h}` : '';
      html += `<div class="palette-item" data-id="${mid}">
        <span class="preview" style="background:${m.color}">${m.icon}</span>
        <span class="name">${m.label}</span>
        <span class="size">${cost}${size}</span>
      </div>`;
    }
  }

  body.innerHTML = html;

  body.querySelectorAll('.palette-item').forEach((el) => {
    el.onclick = () => {
      body.querySelectorAll('.palette-item').forEach((x) => x.classList.remove('active'));
      el.classList.add('active');
      const id = el.dataset.id;
      if (id?.startsWith('belt_')) {
        S.mode = 'belt';
        S._beltDir = el.dataset.dir || 'e';
        setStatus('点击地图放置传送带（右键取消）');
      } else if (id === 'corner') {
        S.mode = 'corner';
        S._beltDir = el.dataset.dir || 'e';
        S._beltEntry = el.dataset.entry || 'w';
        setStatus('点击地图放置弯头传送带（右键取消）');
      } else if (id === '__remove__') {
        S.mode = '__remove__';
        setStatus('点击地图上的建筑回收（返还一半成本）');
      } else if (el.dataset.preset) {
        S.mode = '__preset__';
        S._presetId = el.dataset.preset;
        setStatus('点击地图选择放置预制产线的位置（右键取消）');
      } else if (id) {
        S.mode = id;
        S._facing = 'e';
        const m = S.meta.machines[id];
        setStatus(`点击地图放置「${m?.label || id}」（R 键旋转方向，右键取消）`);
      }
    };
  });
}

// ──── HUD ────
function updateHUD() {
  if (!S.world) return;
  $('#hudTick').textContent = `⏱ ${S.world.tick}`;
  $('#hudMoney').textContent = `💰 ¥${S.world.money.toLocaleString()}`;
  $('#hudSpeed').value = S.world.speed;
  $('#hudPause').textContent = S.world.paused ? '▶' : '⏸';
  const inv = S.world.inventory || {};
  const parts = [];
  for (const [id, item] of Object.entries(S.meta?.items || {})) {
    const qty = inv[id] || 0;
    if (qty > 0) parts.push(`${item.label}:${qty}`);
  }
  $('#hudItems').textContent = parts.length ? parts.join('  ') : '';
  renderOrders();
  checkQuestProgress();
}

// ──── 订单系统 ────
function renderOrders() {
  const orders = S.world?.orders || [];
  const open = orders.filter(o => o.status === 'open');
  const scroll = $('#orderScroll');
  if (!scroll) return;
  if (!open.length) {
    scroll.innerHTML = '<span class="order-empty">暂无订单</span>';
    return;
  }
  let html = '';
  for (const o of open) {
    const items = Object.entries(o.items).map(([id, qty]) => {
      const label = S.meta?.items?.[id]?.label || id;
      return `${label}×${qty}`;
    }).join(' ');
    const remain = o.deadline - S.world.tick;
    const urgent = remain < 50 ? 'urgent' : '';
    html += `<div class="order-item">
      <span class="items">📋 ${items}</span>
      <span class="reward">¥${o.reward}</span>
      <span class="deadline ${urgent}">⏱${remain}t</span>
    </div>`;
  }
  scroll.innerHTML = html;
}

// ──── 渲染 ────
function render() {
  try {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!S.world) {
      ctx.fillStyle = '#666';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('连接中…', canvas.width / 2, canvas.height / 2);
      ctx.fillText('(等待 WebSocket 连接)', canvas.width / 2, canvas.height / 2 + 20);
    } else {
      drawGrid();
      drawTiles();
      drawHover();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`地图: ${S.world.width}×${S.world.height}  tiles: ${Object.keys(S.world.tiles).length}  zoom:${S.camera.zoom.toFixed(1)}x`, canvas.width - 10, 10);
    }
  } catch (e) {
    console.error('Render error:', e);
  }
  requestAnimationFrame(render);
}

function drawGrid() {
  const { width, height } = S.world;
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 0.5;
  const cs = cellSize();
  for (let x = 0; x <= width; x++) {
    ctx.beginPath(); ctx.moveTo(toScreenX(x), toScreenY(0)); ctx.lineTo(toScreenX(x), toScreenY(height)); ctx.stroke();
  }
  for (let y = 0; y <= height; y++) {
    ctx.beginPath(); ctx.moveTo(toScreenX(0), toScreenY(y)); ctx.lineTo(toScreenX(width), toScreenY(y)); ctx.stroke();
  }
}

function drawTiles() {
  for (const [key, tile] of Object.entries(S.world.tiles)) {
    if (tile._ref) continue;
    const [x, y] = key.split(',').map(Number);
    if (tile.machineId) drawMachine(x, y, tile);
    if (tile.beltDir) drawBelt(x, y, tile);
  }
  for (const [key, tile] of Object.entries(S.world.tiles)) {
    if (tile.beltDir && tile.beltItems?.length) {
      const [x, y] = key.split(',').map(Number);
      drawBeltItems(x, y, tile);
    }
  }
}

function drawMachine(x, y, tile) {
  const def = S.meta?.machines[tile.machineId];
  if (!def) return;
  const cx = toScreenX(x), cy = toScreenY(y), cs = cellSize();
  const w = (def.size?.w || 1) * cs - 2, h = (def.size?.h || 1) * cs - 2;
  ctx.fillStyle = def.color;
  ctx.fillRect(cx + 1, cy + 1, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx + 1, cy + 1, w, h);
  ctx.fillStyle = '#fff';
  ctx.font = `${cs * 0.5}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.icon || '?', cx + w / 2, cy + h / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `${Math.max(9, cs * 0.22)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(def.label, cx + w / 2, cy + h + 2);
  if (tile.progress != null) {
    const barH = Math.max(3, cs * 0.08);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx + 2, cy + h - barH - 1, w - 4, barH);
    ctx.fillStyle = '#58a6ff';
    ctx.fillRect(cx + 2, cy + h - barH - 1, (w - 4) * tile.progress, barH);
  }
  const dirs = { e: [1, 0.5], s: [0.5, 1], w: [0, 0.5], n: [0.5, 0] };
  const d = dirs[tile.facing || 'e'];
  if (d) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `${Math.max(9, cs * 0.22)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText({ e: '▸', s: '▾', w: '◂', n: '▴' }[tile.facing || 'e'] || '▸', cx + d[0] * w, cy + d[1] * h);
  }
}

function drawBelt(x, y, tile) {
  const cx = toScreenX(x), cy = toScreenY(y), cs = cellSize();
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(cx, cy, cs, cs);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = Math.max(1, cs * 0.04);
  const centerX = cx + cs / 2, centerY = cy + cs / 2, m = cs * 0.08;
  if (tile.beltEntry && tile.beltDir !== tile.beltEntry) {
    const ep = { w: { x: cx + m, y: centerY }, e: { x: cx + cs - m, y: centerY }, n: { x: centerX, y: cy + m }, s: { x: centerX, y: cy + cs - m } }[tile.beltEntry];
    const xp = { e: { x: cx + cs - m, y: centerY }, w: { x: cx + m, y: centerY }, s: { x: centerX, y: cy + cs - m }, n: { x: centerX, y: cy + m } }[tile.beltDir];
    if (ep && xp) {
      ctx.beginPath(); ctx.moveTo(ep.x, ep.y); ctx.lineTo(centerX, centerY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(xp.x, xp.y); ctx.stroke();
    }
  } else {
    switch (tile.beltDir) {
      case 'e': ctx.beginPath(); ctx.moveTo(cx + m, centerY); ctx.lineTo(cx + cs - m, centerY); ctx.stroke(); break;
      case 'w': ctx.beginPath(); ctx.moveTo(cx + cs - m, centerY); ctx.lineTo(cx + m, centerY); ctx.stroke(); break;
      case 's': ctx.beginPath(); ctx.moveTo(centerX, cy + m); ctx.lineTo(centerX, cy + cs - m); ctx.stroke(); break;
      case 'n': ctx.beginPath(); ctx.moveTo(centerX, cy + cs - m); ctx.lineTo(centerX, cy + m); ctx.stroke(); break;
    }
  }
}

function drawBeltItems(x, y, tile) {
  if (!tile.beltItems?.length) return;
  const cx = toScreenX(x), cy = toScreenY(y), cs = cellSize();
  const centerX = cx + cs / 2, centerY = cy + cs / 2, m = cs * 0.08;
  const cornerEntry = tile.beltEntry ? { w: { x: cx + m, y: centerY }, e: { x: cx + cs - m, y: centerY }, n: { x: centerX, y: cy + m }, s: { x: centerX, y: cy + cs - m } }[tile.beltEntry] : null;
  const cornerExit = tile.beltEntry ? { e: { x: cx + cs - m, y: centerY }, w: { x: cx + m, y: centerY }, s: { x: centerX, y: cy + cs - m }, n: { x: centerX, y: cy + m } }[tile.beltDir] : null;
  for (const item of tile.beltItems) {
    const def = S.meta?.items?.[item.itemId];
    const color = def?.color || '#888';
    const r = Math.max(2, cs * 0.08);
    let px, py;
    if (cornerEntry && cornerExit) {
      if (item.progress < 0.5) {
        const t = item.progress / 0.5;
        px = cornerEntry.x + (centerX - cornerEntry.x) * t;
        py = cornerEntry.y + (centerY - cornerEntry.y) * t;
      } else {
        const t = (item.progress - 0.5) / 0.5;
        px = centerX + (cornerExit.x - centerX) * t;
        py = centerY + (cornerExit.y - centerY) * t;
      }
    } else {
      px = cx + cs * 0.08 + item.progress * (cs - cs * 0.16);
      py = centerY;
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.5; ctx.stroke();
  }
}

function drawHover() {
  if (!S.hoverTile || !S.world) return;
  const { x, y } = S.hoverTile;
  if (x < 0 || x >= S.world.width || y < 0 || y >= S.world.height) return;
  const cx = toScreenX(x), cy = toScreenY(y), cs = cellSize();
  if (S.mode) {
    let w = cs, h = cs;
    if (S.mode !== 'belt' && S.mode !== 'corner' && S.mode !== '__preset__') {
      const def = S.meta?.machines[S.mode];
      if (def) { w = (def.size?.w || 1) * cs; h = (def.size?.h || 1) * cs; }
    }
    ctx.fillStyle = 'rgba(88, 166, 255, 0.3)';
    ctx.fillRect(cx, cy, w, h);
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.8)'; ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, w, h);
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    ctx.strokeRect(cx, cy, cs, cs);
  }
}

// ──── 新手引导系统 ────
const QUEST_STEPS = [
  { label: '认识地图：地图上有两台预置的采矿机（⛏），它们每 tick 自动产铁矿石和铜矿石。', check: () => true },
  { label: '放置传送带：在右侧面板选择「传送带 →」，然后在采矿机右侧（3,4) 点击放置传送带，把矿石运出去。', check: (w) => !!w.tiles['4,3']?.beltDir || !!w.tiles['4,6']?.beltDir },
  { label: '放置熔炉：在右侧面板选择「熔炉」，放在传送带末端，它会自动把铁矿石烧成铁板。', check: (w) => Object.values(w.tiles).some(t => t.machineId === 'furnace') },
  { label: '扩建产线：在熔炉输出侧再接传送带，最终产出物（电路板/引擎等）会自动卖钱。先架起一台组装机（⚙）。', check: (w) => Object.values(w.tiles).some(t => t.machineId === 'assembler') },
  { label: '试试铜矿：用铜矿机产的铜矿石，放一台铜熔炉（🔥）烧出铜板，为造电路板做准备。', check: (w) => Object.values(w.tiles).some(t => t.machineId === 'copper_furnace') },
  { label: '冲压机：用冲压机（⬜）把铁板压成铁梁，用于制造更高级的产品。', check: (w) => Object.values(w.tiles).some(t => t.machineId === 'beam_press') },
  { label: '电路板：用铜板 + 铁板，通过电路装配机（🔬）造出电路板，值 ¥35/个！', check: (w) => Object.values(w.tiles).some(t => t.machineId === 'circuit_assembler') },
  { label: '终极产品：用齿轮 + 铁梁，通过引擎装配机（🚀）造出引擎，这是最值钱的产品！', check: (w) => Object.values(w.tiles).some(t => t.machineId === 'engine_assembler') },
  { label: '大师之路：加速到 6x 看看你的工厂全力运转的样子。提示：左上角速度下拉。', check: (w) => w.speed >= 6, hidden: () => true },
];

function getQuestProgress() {
  if (!S.world) return { done: 0, total: QUEST_STEPS.length };
  let done = 0;
  for (const step of QUEST_STEPS) { if (step.check(S.world, S.meta)) done++; }
  return { done, total: QUEST_STEPS.length };
}

function checkQuestProgress() {
  const questBtn = $('#questBtn');
  if (!questBtn) return;
  const { done, total } = getQuestProgress();
  questBtn.textContent = `📖 ${done}/${total}`;
  if ($('#questPanel').style.display !== 'none') renderQuest();
}

function openQuest() { $('#questPanel').style.display = 'flex'; renderQuest(); }
function closeQuest() { $('#questPanel').style.display = 'none'; }

function renderQuest() {
  if (!S.world) return;
  const { done, total } = getQuestProgress();
  const allDone = done >= total;
  let html = [];
  if (allDone) {
    html.push('<h2>🎉 恭喜通关！</h2>',
      '<p>你已经掌握了所有基础机器和产线设计。接下来可以：</p>',
      '<p>• 扩大工厂：复制更多的产线，提高产量</p>',
      '<p>• 优化布局：把产线排得更紧凑高效</p>',
      '<p>• 赚更多钱：造出引擎，单价 ¥80 是最值钱的产品</p>',
      '<p>（后续还会加入订单系统、科技树、随机事件）</p>');
  } else {
    html.push('<h2>🏭 工厂新手引导</h2>',
      '<p>按顺序完成以下步骤，逐步掌握工厂的玩法：</p>');
  }
  for (let i = 0; i < QUEST_STEPS.length; i++) {
    const step = QUEST_STEPS[i];
    if (step.hidden?.() && !step.check(S.world, S.meta)) continue;
    const isDone = step.check(S.world, S.meta);
    html.push(`<div class="step ${isDone ? 'done' : ''}">`,
      `<span class="num">${isDone ? '✓' : (i + 1)}</span>`,
      `<span class="text">${step.label}</span>`,
      `</div>`);
  }
  html.push(`<div class="quest-actions"><button onclick="closeQuest()">${allDone ? '继续玩' : '知道了'}</button></div>`);
  $('#questBody').innerHTML = html.join('');
}

// ──── 启动 ────
boot();