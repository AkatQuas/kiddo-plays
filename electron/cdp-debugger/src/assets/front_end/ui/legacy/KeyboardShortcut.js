import * as Host from "../../core/host/host.js";
import { DefaultShortcutSetting } from "./ShortcutRegistry.js";
export class KeyboardShortcut {
  descriptors;
  action;
  type;
  keybindSets;
  constructor(descriptors, action, type, keybindSets) {
    this.descriptors = descriptors;
    this.action = action;
    this.type = type;
    this.keybindSets = keybindSets || /* @__PURE__ */ new Set();
  }
  title() {
    return this.descriptors.map((descriptor) => descriptor.name).join(" ");
  }
  isDefault() {
    return this.type === Type.DefaultShortcut || this.type === Type.DisabledDefault || this.type === Type.KeybindSetShortcut && this.keybindSets.has(DefaultShortcutSetting);
  }
  changeType(type) {
    return new KeyboardShortcut(this.descriptors, this.action, type);
  }
  changeKeys(descriptors) {
    this.descriptors = descriptors;
    return this;
  }
  descriptorsMatch(descriptors) {
    if (descriptors.length !== this.descriptors.length) {
      return false;
    }
    return descriptors.every((descriptor, index) => descriptor.key === this.descriptors[index].key);
  }
  hasKeybindSet(keybindSet) {
    return !this.keybindSets || this.keybindSets.has(keybindSet);
  }
  equals(shortcut) {
    return this.descriptorsMatch(shortcut.descriptors) && this.type === shortcut.type && this.action === shortcut.action;
  }
  static createShortcutFromSettingObject(settingObject) {
    return new KeyboardShortcut(settingObject.descriptors, settingObject.action, settingObject.type);
  }
  static makeKey(keyCode, modifiers) {
    if (typeof keyCode === "string") {
      keyCode = keyCode.charCodeAt(0) - (/^[a-z]/.test(keyCode) ? 32 : 0);
    }
    modifiers = modifiers || Modifiers.None;
    return KeyboardShortcut.makeKeyFromCodeAndModifiers(keyCode, modifiers);
  }
  static makeKeyFromEvent(keyboardEvent) {
    let modifiers = Modifiers.None;
    if (keyboardEvent.shiftKey) {
      modifiers |= Modifiers.Shift;
    }
    if (keyboardEvent.ctrlKey) {
      modifiers |= Modifiers.Ctrl;
    }
    if (keyboardEvent.altKey) {
      modifiers |= Modifiers.Alt;
    }
    if (keyboardEvent.metaKey) {
      modifiers |= Modifiers.Meta;
    }
    const keyCode = keyboardEvent.keyCode || keyboardEvent["__keyCode"];
    return KeyboardShortcut.makeKeyFromCodeAndModifiers(keyCode, modifiers);
  }
  static makeKeyFromEventIgnoringModifiers(keyboardEvent) {
    const keyCode = keyboardEvent.keyCode || keyboardEvent["__keyCode"];
    return KeyboardShortcut.makeKeyFromCodeAndModifiers(keyCode, Modifiers.None);
  }
  static eventHasCtrlEquivalentKey(event) {
    return Host.Platform.isMac() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  }
  static eventHasEitherCtrlOrMeta(event) {
    return event.metaKey || event.ctrlKey;
  }
  static hasNoModifiers(event) {
    const keyboardEvent = event;
    return !keyboardEvent.ctrlKey && !keyboardEvent.shiftKey && !keyboardEvent.altKey && !keyboardEvent.metaKey;
  }
  static makeDescriptor(key, modifiers) {
    return {
      key: KeyboardShortcut.makeKey(typeof key === "string" ? key : key.code, modifiers),
      name: KeyboardShortcut.shortcutToString(key, modifiers)
    };
  }
  static makeDescriptorFromBindingShortcut(shortcut) {
    const [keyString, ...modifierStrings] = shortcut.split(/\+(?!$)/).reverse();
    let modifiers = 0;
    for (const modifierString of modifierStrings) {
      const modifier = Modifiers[modifierString];
      console.assert(typeof modifier !== "undefined", `Only one key other than modifier is allowed in shortcut <${shortcut}>`);
      modifiers |= modifier;
    }
    console.assert(keyString.length > 0, `Modifiers-only shortcuts are not allowed (encountered <${shortcut}>)`);
    const key = Keys[keyString] || KeyBindings[keyString];
    if (key && "shiftKey" in key && key.shiftKey) {
      modifiers |= Modifiers.Shift;
    }
    return KeyboardShortcut.makeDescriptor(key ? key : keyString, modifiers);
  }
  static shortcutToString(key, modifiers) {
    if (typeof key !== "string" && KeyboardShortcut.isModifier(key.code)) {
      return KeyboardShortcut.modifiersToString(modifiers);
    }
    return KeyboardShortcut.modifiersToString(modifiers) + KeyboardShortcut.keyName(key);
  }
  static keyName(key) {
    if (typeof key === "string") {
      return key.toUpperCase();
    }
    if (typeof key.name === "string") {
      return key.name;
    }
    return key.name[Host.Platform.platform()] || key.name.other || "";
  }
  static makeKeyFromCodeAndModifiers(keyCode, modifiers) {
    return keyCode & 255 | (modifiers || 0) << 8;
  }
  static keyCodeAndModifiersFromKey(key) {
    return { keyCode: key & 255, modifiers: key >> 8 };
  }
  static isModifier(key) {
    const { keyCode } = KeyboardShortcut.keyCodeAndModifiersFromKey(key);
    return keyCode === Keys.Shift.code || keyCode === Keys.Ctrl.code || keyCode === Keys.Alt.code || keyCode === Keys.Meta.code;
  }
  static modifiersToString(modifiers) {
    const isMac = Host.Platform.isMac();
    const m = Modifiers;
    const modifierNames = /* @__PURE__ */ new Map([
      [m.Ctrl, isMac ? "Ctrl\u2004" : "Ctrl\u200A+\u200A"],
      [m.Alt, isMac ? "\u2325\u2004" : "Alt\u200A+\u200A"],
      [m.Shift, isMac ? "\u21E7\u2004" : "Shift\u200A+\u200A"],
      [m.Meta, isMac ? "\u2318\u2004" : "Win\u200A+\u200A"]
    ]);
    return [m.Meta, m.Ctrl, m.Alt, m.Shift].map(mapModifiers).join("");
    function mapModifiers(m2) {
      return (modifiers || 0) & m2 ? modifierNames.get(m2) : "";
    }
  }
}
export const Modifiers = {
  None: 0,
  Shift: 1,
  Ctrl: 2,
  Alt: 4,
  Meta: 8,
  CtrlOrMeta: Host.Platform.isMac() ? 8 : 2,
  ShiftOrOption: Host.Platform.isMac() ? 4 : 1
};
const leftKey = {
  code: 37,
  name: "\u2190"
};
const upKey = {
  code: 38,
  name: "\u2191"
};
const rightKey = {
  code: 39,
  name: "\u2192"
};
const downKey = {
  code: 40,
  name: "\u2193"
};
const ctrlKey = {
  code: 17,
  name: "Ctrl"
};
const escKey = {
  code: 27,
  name: "Esc"
};
const spaceKey = {
  code: 32,
  name: "Space"
};
const plusKey = {
  code: 187,
  name: "+"
};
const backquoteKey = {
  code: 192,
  name: "`"
};
const quoteKey = {
  code: 222,
  name: "'"
};
export const Keys = {
  Backspace: { code: 8, name: "\u21A4" },
  Tab: { code: 9, name: { mac: "\u21E5", other: "Tab" } },
  Enter: { code: 13, name: { mac: "\u21A9", other: "Enter" } },
  Shift: { code: 16, name: { mac: "\u21E7", other: "Shift" } },
  Ctrl: ctrlKey,
  Control: ctrlKey,
  Alt: { code: 18, name: "Alt" },
  Esc: escKey,
  Escape: escKey,
  Space: spaceKey,
  " ": spaceKey,
  PageUp: { code: 33, name: { mac: "\u21DE", other: "PageUp" } },
  PageDown: { code: 34, name: { mac: "\u21DF", other: "PageDown" } },
  End: { code: 35, name: { mac: "\u2197", other: "End" } },
  Home: { code: 36, name: { mac: "\u2196", other: "Home" } },
  Left: leftKey,
  Up: upKey,
  Right: rightKey,
  Down: downKey,
  ArrowLeft: leftKey,
  ArrowUp: upKey,
  ArrowRight: rightKey,
  ArrowDown: downKey,
  Delete: { code: 46, name: "Del" },
  Zero: { code: 48, name: "0" },
  H: { code: 72, name: "H" },
  N: { code: 78, name: "N" },
  P: { code: 80, name: "P" },
  Meta: { code: 91, name: "Meta" },
  F1: { code: 112, name: "F1" },
  F2: { code: 113, name: "F2" },
  F3: { code: 114, name: "F3" },
  F4: { code: 115, name: "F4" },
  F5: { code: 116, name: "F5" },
  F6: { code: 117, name: "F6" },
  F7: { code: 118, name: "F7" },
  F8: { code: 119, name: "F8" },
  F9: { code: 120, name: "F9" },
  F10: { code: 121, name: "F10" },
  F11: { code: 122, name: "F11" },
  F12: { code: 123, name: "F12" },
  Semicolon: { code: 186, name: ";" },
  NumpadPlus: { code: 107, name: "Numpad +" },
  NumpadMinus: { code: 109, name: "Numpad -" },
  Numpad0: { code: 96, name: "Numpad 0" },
  Plus: plusKey,
  Equal: plusKey,
  Comma: { code: 188, name: "," },
  Minus: { code: 189, name: "-" },
  Period: { code: 190, name: "." },
  Slash: { code: 191, name: "/" },
  QuestionMark: { code: 191, name: "?" },
  Apostrophe: backquoteKey,
  Tilde: { code: 192, name: "Tilde" },
  Backquote: backquoteKey,
  IntlBackslash: backquoteKey,
  LeftSquareBracket: { code: 219, name: "[" },
  RightSquareBracket: { code: 221, name: "]" },
  Backslash: { code: 220, name: "\\" },
  SingleQuote: quoteKey,
  Quote: quoteKey,
  get CtrlOrMeta() {
    return Host.Platform.isMac() ? this.Meta : this.Ctrl;
  }
};
export var Type = /* @__PURE__ */ ((Type2) => {
  Type2["UserShortcut"] = "UserShortcut";
  Type2["DefaultShortcut"] = "DefaultShortcut";
  Type2["DisabledDefault"] = "DisabledDefault";
  Type2["UnsetShortcut"] = "UnsetShortcut";
  Type2["KeybindSetShortcut"] = "KeybindSetShortcut";
  return Type2;
})(Type || {});
export const KeyBindings = {};
(function() {
  for (const key in Keys) {
    const descriptor = Keys[key];
    if (typeof descriptor === "object" && descriptor["code"]) {
      const name = typeof descriptor["name"] === "string" ? descriptor["name"] : key;
      KeyBindings[name] = descriptor;
    }
  }
})();
//# sourceMappingURL=KeyboardShortcut.js.map
