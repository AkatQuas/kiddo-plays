import clipboardy from 'clipboardy';
import { createHash } from 'node:crypto';
import { MSG } from './protocol.js';

const MAX_BYTES = 1 * 1024 * 1024; // 1 MB cap — skip huge clipboards (images/large files) for now.

function hash(str) {
  return createHash('sha1').update(str).digest('hex');
}

// Poll-based shared clipboard. Every `pollMs`, read the local clipboard; if
// its text content differs from what we last saw, broadcast it to all peers.
// Incoming clipboard messages are written locally and remembered so our next
// poll doesn't echo them back out.
export default class ClipboardSync {
  constructor({ selfName, network, pollMs = 600 }) {
    this.selfName = selfName;
    this.network = network;
    this.pollMs = pollMs;
    this.lastHash = '';
    this.timer = null;
  }

  async start() {
    try {
      const current = await clipboardy.read();
      this.lastHash = hash(current || '');
    } catch {
      /* clipboard not readable yet — treat as empty */
    }
    this.timer = setInterval(() => {
      this.poll().catch((err) => {
        console.warn('[clip] poll error:', err.message);
      });
    }, this.pollMs);
    if (this.timer.unref) this.timer.unref();
    console.log(`[clip] polling every ${this.pollMs}ms`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async poll() {
    let text;
    try {
      text = await clipboardy.read();
    } catch {
      return;
    }
    if (text == null) return;
    if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) return;
    const h = hash(text);
    if (h === this.lastHash) return;
    this.lastHash = h;
    this.network.broadcast({
      type: MSG.CLIPBOARD,
      content: text,
      origin: this.selfName,
      hash: h,
    });
  }

  async apply(msg) {
    if (!msg || typeof msg.content !== 'string') return;
    if (msg.origin === this.selfName) return;
    if (msg.hash && msg.hash === this.lastHash) return;
    try {
      await clipboardy.write(msg.content);
      this.lastHash = msg.hash || hash(msg.content);
    } catch (err) {
      console.warn('[clip] write failed:', err.message);
    }
  }
}
