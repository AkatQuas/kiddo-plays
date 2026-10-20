import robot from 'robotjs';
import { toRobotKey, translateKeycode } from './keymap.js';

// Injects mouse/keyboard events on the local OS via robotjs.
// robotjs is synchronous; methods stay async so callers can `await` and
// preserve press/release ordering.
export default class Injector {
  constructor({ translateModifiers = true } = {}) {
    robot.setMouseDelay(0);
    robot.setKeyboardDelay(0);
    this._pressedKeys = new Set();
    this.translateModifiers = translateModifiers;
  }

  async init() {
    const { width, height } = robot.getScreenSize();
    this.screenW = width;
    this.screenH = height;
    return { width, height };
  }

  getScreenSize() {
    return { width: this.screenW, height: this.screenH };
  }

  async getMousePos() {
    return robot.getMousePos();
  }

  async moveAbsolute(x, y) {
    robot.moveMouse(x, y);
  }

  async moveRelative(dx, dy) {
    const p = robot.getMousePos();
    let nx = p.x + dx;
    let ny = p.y + dy;
    nx = Math.max(0, Math.min(this.screenW - 1, nx));
    ny = Math.max(0, Math.min(this.screenH - 1, ny));
    robot.moveMouse(nx, ny);
  }

  async mouseButton(name, down) {
    if (name !== 'left' && name !== 'right' && name !== 'middle') return;
    robot.mouseToggle(down ? 'down' : 'up', name);
  }

  async wheel(dx, dy) {
    if (dx === 0 && dy === 0) return;
    // robotjs scrollMouse(x, y): positive y scrolls up on most platforms.
    robot.scrollMouse(dx, -dy);
  }

  async key(uiohookCode, down, sourceOs) {
    const effective =
      sourceOs && this.translateModifiers
        ? translateKeycode(uiohookCode, sourceOs, process.platform)
        : uiohookCode;
    const k = toRobotKey(effective);
    if (k === undefined) return;
    try {
      robot.keyToggle(k, down ? 'down' : 'up');
      if (down) this._pressedKeys.add(k);
      else this._pressedKeys.delete(k);
    } catch (err) {
      console.error('[inject] keyToggle', k, err.message);
    }
  }

  // Release anything we currently believe is held down — safety valve when
  // focus changes mid-keystroke, so we don't leave modifiers stuck on the
  // remote.
  async releaseAll() {
    const keys = [...this._pressedKeys];
    this._pressedKeys.clear();
    for (const k of keys) {
      try {
        robot.keyToggle(k, 'up');
      } catch {
        /* ignore */
      }
    }
  }
}
