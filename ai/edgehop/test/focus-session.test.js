import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import FocusSession from '../src/focus-session.js';

describe('FocusSession', () => {
  it('accepts a newer seq and derives pinning', () => {
    const fs = new FocusSession('a');
    const changes = [];
    fs.on('change', (c) => changes.push(c));

    const c = fs.request('b');
    assert.equal(c.next, 'b');
    assert.equal(c.leftSelf, true);
    assert.equal(c.pinning, true);
    assert.equal(fs.isPinning(), true);
    assert.equal(fs.isFocusedOnSelf(), false);
    assert.equal(changes.length, 1);
  });

  it('rejects older seq', () => {
    const fs = new FocusSession('a');
    fs.applyRemote('b', 100, 'x');
    assert.equal(fs.applyRemote('a', 50, 'y'), null);
    assert.equal(fs.focus, 'b');
  });

  it('on equal seq, higher origin name wins', () => {
    const fs = new FocusSession('a');
    assert.ok(fs.applyRemote('b', 10, 'm'));
    assert.equal(fs.applyRemote('c', 10, 'a'), null); // 'a' < 'm'
    assert.ok(fs.applyRemote('c', 10, 'z')); // 'z' > 'm'
    assert.equal(fs.focus, 'c');
  });

  it('clears pinning when focus returns to self', () => {
    const fs = new FocusSession('a');
    fs.request('b');
    const back = fs.request('a');
    assert.equal(back.pinning, false);
    assert.equal(back.leftSelf, false);
    assert.equal(fs.isPinning(), false);
    assert.equal(fs.isFocusedOnSelf(), true);
  });

  it('does not allow callers to own pinning separately from focus', () => {
    const fs = new FocusSession('a');
    fs.request('b');
    // pinning is owned by FocusSession — flipping the field without _apply
    // is not part of the interface; request/applyRemote are the only writers.
    assert.equal(fs.pinning, true);
    fs.request('a');
    assert.equal(fs.pinning, false);
  });
});
