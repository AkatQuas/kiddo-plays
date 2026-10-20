import config from './config.js';
import FocusSession from './focus-session.js';
import Network from './network.js';
import Injector from './inject.js';
import { UiohookOsInput } from './os-input.js';
import InputPolicy from './input-policy.js';
import ClipboardSync from './clipboard.js';
import { MSG } from './protocol.js';

function logBanner() {
  console.log('─── edgehop ───');
  console.log(`  self     : ${config.selfName} (index ${config.selfIndex})`);
  console.log(`  port     : ${config.port}`);
  console.log(`  devices  : ${config.devices.map((d) => `${d.name}@${d.host}:${d.port}`).join(' | ')}`);
  console.log(`  reclaim  : ${config.reclaimHotkeyName}`);
  console.log('');
  if (process.platform === 'darwin') {
    console.log('macOS: grant Accessibility + Input Monitoring permissions to your');
    console.log('terminal (System Settings → Privacy & Security) or input capture will');
    console.log('silently do nothing.');
  }
  console.log('');
}

async function main() {
  logBanner();

  const focus = new FocusSession(config.selfName);
  const injector = new Injector({ translateModifiers: config.translateModifiers });
  await injector.init();
  const network = new Network();
  const osInput = new UiohookOsInput();
  const input = new InputPolicy({
    focus,
    network,
    pointer: injector,
    osInput,
    layout: {
      selfName: config.selfName,
      selfIndex: config.selfIndex,
      devices: config.devices,
      edgeThreshold: config.edgeThreshold,
      reclaimHotkeyName: config.reclaimHotkeyName,
    },
  });
  const clipboard = config.clipboardSync
    ? new ClipboardSync({
        selfName: config.selfName,
        network,
        pollMs: config.clipboardPollMs,
      })
    : null;

  focus.on('change', async (change) => {
    console.log(`[main] focus → ${change.next} (from ${change.origin})`);
    if (change.leftSelf) {
      await injector.releaseAll().catch(() => {});
    }
  });

  network.on('message', async (msg, from) => {
    switch (msg.type) {
      case MSG.FOCUS: {
        focus.applyRemote(msg.target, msg.seq, msg.origin || from);
        break;
      }
      case MSG.MOUSE_MOVE:
        if (focus.isFocusedOnSelf()) {
          await injector.moveRelative(msg.dx, msg.dy).catch((e) => console.error('[inject]', e.message));
        }
        break;
      case MSG.MOUSE_BUTTON:
        if (focus.isFocusedOnSelf()) {
          await injector.mouseButton(msg.button, msg.down).catch((e) => console.error('[inject]', e.message));
        }
        break;
      case MSG.MOUSE_WHEEL:
        if (focus.isFocusedOnSelf()) {
          await injector.wheel(msg.dx || 0, msg.dy || 0).catch((e) => console.error('[inject]', e.message));
        }
        break;
      case MSG.KEY:
        if (focus.isFocusedOnSelf()) {
          await injector
            .key(msg.keycode, msg.down, msg.sos)
            .catch((e) => console.error('[inject]', e.message));
        }
        break;
      case MSG.CLIPBOARD:
        if (clipboard) await clipboard.apply(msg).catch(() => {});
        break;
      default:
        console.warn('[main] unknown message type:', msg.type);
    }
  });

  network.start();
  await input.start();
  if (clipboard) await clipboard.start();

  const shutdown = async (sig) => {
    console.log(`\n[main] ${sig} — shutting down`);
    input.stop();
    if (clipboard) clipboard.stop();
    await injector.releaseAll().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log(`[main] ready. initial focus: ${focus.focus}`);
}

main().catch((err) => {
  console.error('[main] fatal:', err);
  process.exit(1);
});
