import { UiohookKey } from 'uiohook-napi';

// Map uiohook keycodes → robotjs key names (strings accepted by keyToggle).
// Single-character keys use the literal char; named keys use robotjs's table
// (command, control, shift, f1, …).
const map = new Map();

function add(uName, robotKey) {
  const uc = UiohookKey[uName];
  if (uc !== undefined && robotKey != null) map.set(uc, robotKey);
}

// Letters A–Z → lowercase (robotjs keyCodeForChar)
for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') add(ch, ch.toLowerCase());

// Digits
for (let i = 0; i <= 9; i++) add(String(i), String(i));

// Function keys
for (let i = 1; i <= 24; i++) add(`F${i}`, `f${i}`);

// Whitespace / editing
add('Space', 'space');
add('Enter', 'enter');
add('Escape', 'escape');
add('Backspace', 'backspace');
add('Tab', 'tab');
add('CapsLock', 'capslock');
add('Delete', 'delete');
add('Insert', 'insert');
add('Home', 'home');
add('End', 'end');
add('PageUp', 'pageup');
add('PageDown', 'pagedown');
add('PrintScreen', 'printscreen');
// ScrollLock / Pause: not in robotjs's named table — omit (reclaim stays on capture side)

// Arrows
add('ArrowUp', 'up');
add('ArrowDown', 'down');
add('ArrowLeft', 'left');
add('ArrowRight', 'right');

// Modifiers
add('Ctrl', 'control');
add('Alt', 'alt');
add('Shift', 'shift');
add('Meta', 'command');
add('CtrlRight', 'right_control');
add('AltRight', 'right_alt');
add('ShiftRight', 'right_shift');
add('MetaRight', 'command'); // robotjs has no distinct right_command

// Punctuation (single-char path in robotjs)
add('Semicolon', ';');
add('Equal', '=');
add('Comma', ',');
add('Minus', '-');
add('Period', '.');
add('Slash', '/');
add('Backquote', '`');
add('BracketLeft', '[');
add('Backslash', '\\');
add('BracketRight', ']');
add('Quote', "'");

// Numpad
for (let i = 0; i <= 9; i++) add(`Numpad${i}`, `numpad_${i}`);
add('NumpadAdd', 'numpad_+');
add('NumpadSubtract', 'numpad_-');
add('NumpadMultiply', 'numpad_*');
add('NumpadDivide', 'numpad_/');
add('NumpadDecimal', 'numpad_.');
add('NumpadEnter', 'enter');
add('NumLock', 'numpad_lock');

export function toRobotKey(keycode) {
  return map.get(keycode);
}

// For hotkey matching: find the uiohook keycode for a name like "ScrollLock".
export function keycodeByName(name) {
  return UiohookKey[name];
}

// Cross-OS modifier translation.
//
//   Mac→Win/Linux : Meta (Cmd)  → Ctrl    (so Cmd+C on Mac pastes as Ctrl+C on Win)
//   Win/Linux→Mac : Ctrl        → Meta   (so Ctrl+C on Win pastes as Cmd+C on Mac)
export function translateKeycode(keycode, sourceOs, localOs) {
  if (sourceOs === localOs) return keycode;
  const META = UiohookKey.Meta;
  const CTRL = UiohookKey.Ctrl;
  const METAR = UiohookKey.MetaRight;
  const CTRLR = UiohookKey.CtrlRight;
  if (sourceOs === 'darwin' && localOs !== 'darwin') {
    if (keycode === META) return CTRL;
    if (METAR !== undefined && keycode === METAR) return CTRLR ?? CTRL;
  } else if (sourceOs !== 'darwin' && localOs === 'darwin') {
    if (keycode === CTRL) return META;
    if (CTRLR !== undefined && keycode === CTRLR) return METAR ?? META;
  }
  return keycode;
}
