import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function parseDevices(raw) {
  if (!raw) throw new Error('DEVICES env var is empty');
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const at = entry.indexOf('@');
      if (at < 0) throw new Error(`Bad DEVICES entry "${entry}" — expected name@host:port`);
      const name = entry.slice(0, at);
      const addr = entry.slice(at + 1);
      const colon = addr.lastIndexOf(':');
      if (colon < 0) throw new Error(`Bad DEVICES entry "${entry}" — missing :port`);
      const host = addr.slice(0, colon);
      const port = Number(addr.slice(colon + 1));
      if (!Number.isInteger(port)) throw new Error(`Bad port in "${entry}"`);
      return { name, host, port };
    });
}

const devices = parseDevices(process.env.DEVICES);
const selfName = process.env.SELF_NAME;
if (!selfName) throw new Error('SELF_NAME env var is empty');

const selfIndex = devices.findIndex((d) => d.name === selfName);
if (selfIndex < 0) {
  throw new Error(`SELF_NAME "${selfName}" not in DEVICES list`);
}

const names = new Set();
for (const d of devices) {
  if (names.has(d.name)) throw new Error(`Duplicate device name "${d.name}" in DEVICES`);
  names.add(d.name);
}

const config = {
  devices,
  selfName,
  selfIndex,
  selfDevice: devices[selfIndex],
  port: devices[selfIndex].port,
  edgeThreshold: Number(process.env.EDGE_THRESHOLD || 2),
  reclaimHotkeyName: process.env.RECLAIM_HOTKEY_NAME || 'ScrollLock',
  clipboardSync: (process.env.CLIPBOARD_SYNC || 'true').toLowerCase() !== 'false',
  clipboardPollMs: Number(process.env.CLIPBOARD_POLL_MS || 600),
  translateModifiers: (process.env.TRANSLATE_MODIFIERS || 'true').toLowerCase() !== 'false',
};

export default config;
