import { MSG } from './protocol.js';
import { keycodeByName } from './keymap.js';

const EDGE_DEBOUNCE_MS = 500;

// Deep module: edge switching, reclaim, pin-forward path.
// OsInput + pointer sink sit behind seams; FocusSession owns pinning.
export default class InputPolicy {
  constructor({ focus, network, pointer, osInput, layout, sourceOs = process.platform }) {
    this.focus = focus;
    this.network = network;
    this.pointer = pointer;
    this.osInput = osInput;
    this.layout = layout;
    this.sourceOs = sourceOs;

    this.screenW = 1920;
    this.screenH = 1080;
    this.pinX = 960;
    this.pinY = 540;
    this.edgeDebounceUntil = 0;

    this.reclaimKeycode = keycodeByName(layout.reclaimHotkeyName);
    if (this.reclaimKeycode === undefined && layout.reclaimHotkeyName !== '0') {
      console.warn(
        `[input] reclaim hotkey "${layout.reclaimHotkeyName}" not recognised; disabled.`,
      );
    }
  }

  async start() {
    const { width, height } = this.pointer.getScreenSize();
    this.screenW = width;
    this.screenH = height;
    this.pinX = Math.floor(width / 2);
    this.pinY = Math.floor(height / 2);

    this.focus.on('change', (change) => this.onFocusChange(change));

    this.osInput.start({
      onMove: (e) => this.onMouseMove(e),
      onButton: (e) => this.onMouseButton(e),
      onWheel: (e) => this.onWheel(e),
      onKey: (e) => this.onKey(e),
    });

    if (this.focus.isPinning()) {
      this.pointer.moveAbsolute(this.pinX, this.pinY).catch(() => {});
    }

    console.log(`[input] local screen ${width}×${height}; pin=(${this.pinX},${this.pinY})`);
  }

  stop() {
    this.osInput.stop();
  }

  onFocusChange({ pinning }) {
    this.edgeDebounceUntil = Date.now() + EDGE_DEBOUNCE_MS;
    if (pinning) {
      this.pointer.moveAbsolute(this.pinX, this.pinY).catch(() => {});
    }
  }

  onMouseMove(e) {
    if (this.focus.isPinning()) {
      if (e.x === this.pinX && e.y === this.pinY) return;
      const dx = e.x - this.pinX;
      const dy = e.y - this.pinY;
      if (dx === 0 && dy === 0) return;
      this.network.sendTo(this.focus.focus, {
        type: MSG.MOUSE_MOVE,
        dx,
        dy,
      });
      this.pointer.moveAbsolute(this.pinX, this.pinY).catch(() => {});
      return;
    }

    if (this.focus.isFocusedOnSelf()) {
      this.detectEdge(e.x, e.y);
    }
  }

  detectEdge(x, y) {
    if (Date.now() < this.edgeDebounceUntil) return;
    const th = this.layout.edgeThreshold;
    const idx = this.layout.selfIndex;
    const devices = this.layout.devices;

    if (x <= th && idx > 0) {
      this.switchFocus(devices[idx - 1].name);
    } else if (x >= this.screenW - 1 - th && idx < devices.length - 1) {
      this.switchFocus(devices[idx + 1].name);
    }
  }

  switchFocus(targetName) {
    const change = this.focus.request(targetName);
    if (!change) return;
    this.network.broadcast({
      type: MSG.FOCUS,
      target: change.next,
      seq: change.seq,
      origin: change.origin,
    });
  }

  onMouseButton(e) {
    if (!this.focus.isPinning()) return;
    const name = e.button === 1 ? 'left' : e.button === 2 ? 'right' : 'middle';
    this.network.sendTo(this.focus.focus, {
      type: MSG.MOUSE_BUTTON,
      button: name,
      down: e.down,
    });
  }

  onWheel(e) {
    if (!this.focus.isPinning()) return;
    const horizontal = e.direction === 4;
    const ticks = e.rotation || 0;
    const dx = horizontal ? ticks : 0;
    const dy = horizontal ? 0 : ticks;
    if (dx === 0 && dy === 0) return;
    this.network.sendTo(this.focus.focus, {
      type: MSG.MOUSE_WHEEL,
      dx,
      dy,
    });
  }

  onKey(e) {
    if (
      e.down &&
      this.reclaimKeycode !== undefined &&
      e.keycode === this.reclaimKeycode
    ) {
      if (!this.focus.isFocusedOnSelf()) {
        console.log('[input] reclaim hotkey → focus self');
        this.switchFocus(this.layout.selfName);
      }
      return;
    }

    if (!this.focus.isPinning()) return;
    this.network.sendTo(this.focus.focus, {
      type: MSG.KEY,
      keycode: e.keycode,
      down: e.down,
      sos: this.sourceOs,
    });
  }
}
