import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import FocusSession from '../src/focus-session.js';
import InputPolicy from '../src/input-policy.js';
import { MSG } from '../src/protocol.js';

class FakeOsInput {
  start(handlers) {
    this.handlers = handlers;
  }
  stop() {
    this.handlers = null;
  }
}

function makeHarness(overrides = {}) {
  const focus = new FocusSession('mid');
  const sent = [];
  const broadcasts = [];
  const warps = [];
  const network = {
    sendTo(name, msg) {
      sent.push({ name, msg });
      return true;
    },
    broadcast(msg) {
      broadcasts.push(msg);
    },
  };
  const pointer = {
    getScreenSize: () => ({ width: 1000, height: 800 }),
    moveAbsolute: async (x, y) => {
      warps.push({ x, y });
    },
  };
  const osInput = new FakeOsInput();
  const layout = {
    selfName: 'mid',
    selfIndex: 1,
    devices: [
      { name: 'left', host: '1', port: 1 },
      { name: 'mid', host: '2', port: 1 },
      { name: 'right', host: '3', port: 1 },
    ],
    edgeThreshold: 2,
    reclaimHotkeyName: '0',
    ...overrides.layout,
  };
  const policy = new InputPolicy({
    focus,
    network,
    pointer,
    osInput,
    layout,
    sourceOs: 'darwin',
    ...overrides,
  });
  return { focus, policy, osInput, sent, broadcasts, warps, layout };
}

describe('InputPolicy', () => {
  let h;

  beforeEach(async () => {
    h = makeHarness();
    await h.policy.start();
  });

  it('switches focus left on left-edge hit and broadcasts FOCUS', () => {
    h.osInput.handlers.onMove({ x: 0, y: 400 });
    assert.equal(h.focus.focus, 'left');
    assert.equal(h.broadcasts.length, 1);
    assert.equal(h.broadcasts[0].type, MSG.FOCUS);
    assert.equal(h.broadcasts[0].target, 'left');
    assert.equal(h.focus.isPinning(), true);
  });

  it('switches focus right on right-edge hit', () => {
    h.osInput.handlers.onMove({ x: 999, y: 400 });
    assert.equal(h.focus.focus, 'right');
    assert.equal(h.broadcasts[0].target, 'right');
  });

  it('forwards relative moves while pinning and warps back to pin point', () => {
    h.focus.request('right');
    h.sent.length = 0;
    h.warps.length = 0;

    h.osInput.handlers.onMove({ x: h.policy.pinX + 5, y: h.policy.pinY - 3 });
    assert.equal(h.sent.length, 1);
    assert.deepEqual(h.sent[0].msg, { type: MSG.MOUSE_MOVE, dx: 5, dy: -3 });
    assert.equal(h.sent[0].name, 'right');
    assert.ok(h.warps.some((w) => w.x === h.policy.pinX && w.y === h.policy.pinY));
  });

  it('forwards keys with source OS while pinning', () => {
    h.focus.request('left');
    h.sent.length = 0;
    h.osInput.handlers.onKey({ keycode: 30, down: true });
    assert.equal(h.sent[0].msg.type, MSG.KEY);
    assert.equal(h.sent[0].msg.sos, 'darwin');
    assert.equal(h.sent[0].name, 'left');
  });

  it('does not forward keys when focused on self', () => {
    h.osInput.handlers.onKey({ keycode: 30, down: true });
    assert.equal(h.sent.length, 0);
  });
});
