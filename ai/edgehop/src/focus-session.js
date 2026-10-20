import { EventEmitter } from 'node:events';

// Deep module: single place for "who has input" + local pinning.
//
// Focus changes are ordered by (seq, originName). Higher seq wins; on tie,
// lexicographically larger originName wins. seq is Date.now() of the issuer.
//
// Pinning is derived: focus !== selfName. Callers must not write `pinning`.
export default class FocusSession extends EventEmitter {
  constructor(selfName, initialFocus = selfName) {
    super();
    this.selfName = selfName;
    this.focus = initialFocus;
    this.focusSeq = 0;
    this.focusOrigin = '';
    this.pinning = initialFocus !== selfName;
  }

  isFocusedOnSelf() {
    return this.focus === this.selfName;
  }

  isPinning() {
    return this.pinning;
  }

  // Apply a focus claim from the wire (or any remote issuer).
  // Returns a change descriptor if accepted, otherwise null.
  applyRemote(target, seq, origin) {
    return this._apply(target, seq, origin);
  }

  // Local origination of a focus change (edge switch, reclaim, …).
  // seq is at least focusSeq+1 so two local requests in the same millisecond
  // (same origin) still order correctly.
  request(target) {
    const seq = Math.max(Date.now(), this.focusSeq + 1);
    return this._apply(target, seq, this.selfName);
  }

  _apply(target, seq, origin) {
    if (seq < this.focusSeq) return null;
    if (seq === this.focusSeq && origin <= this.focusOrigin) return null;

    const prev = this.focus;
    const leftSelf = prev === this.selfName && target !== this.selfName;
    this.focus = target;
    this.focusSeq = seq;
    this.focusOrigin = origin;
    this.pinning = target !== this.selfName;

    const change = {
      prev,
      next: target,
      origin,
      seq,
      pinning: this.pinning,
      leftSelf,
    };
    this.emit('change', change);
    return change;
  }
}
