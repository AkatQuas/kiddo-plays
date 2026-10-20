import { uIOhook } from 'uiohook-napi';

// Production OsInput adapter: observe global input via uiohook-napi.
//
// Does NOT swallow events (library limitation). InputPolicy parks the cursor
// while pinning to reduce accidental local clicks.
//
// Interface (handlers):
//   onMove({ x, y })
//   onButton({ button /* 1|2|3 */, down })
//   onWheel({ rotation, direction })
//   onKey({ keycode, down })
export class UiohookOsInput {
  constructor() {
    this._handlers = null;
    this._bound = null;
  }

  start(handlers) {
    if (this._handlers) throw new Error('OsInput already started');
    this._handlers = handlers;

    this._bound = {
      move: (e) => handlers.onMove({ x: e.x, y: e.y }),
      buttonDown: (e) => handlers.onButton({ button: e.button, down: true }),
      buttonUp: (e) => handlers.onButton({ button: e.button, down: false }),
      wheel: (e) => handlers.onWheel({ rotation: e.rotation || 0, direction: e.direction }),
      keyDown: (e) => handlers.onKey({ keycode: e.keycode, down: true }),
      keyUp: (e) => handlers.onKey({ keycode: e.keycode, down: false }),
    };

    uIOhook.on('mousemove', this._bound.move);
    uIOhook.on('mousedrag', this._bound.move);
    uIOhook.on('mousedown', this._bound.buttonDown);
    uIOhook.on('mouseup', this._bound.buttonUp);
    uIOhook.on('wheel', this._bound.wheel);
    uIOhook.on('keydown', this._bound.keyDown);
    uIOhook.on('keyup', this._bound.keyUp);
    uIOhook.start();
  }

  stop() {
    if (!this._bound) return;
    try {
      uIOhook.stop();
    } catch {
      /* ignore */
    }
    this._handlers = null;
    this._bound = null;
  }
}
