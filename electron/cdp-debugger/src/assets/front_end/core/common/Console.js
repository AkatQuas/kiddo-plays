import { ObjectWrapper } from "./Object.js";
import { reveal } from "./Revealer.js";
let consoleInstance;
export class Console extends ObjectWrapper {
  #messagesInternal;
  constructor() {
    super();
    this.#messagesInternal = [];
  }
  static instance({ forceNew } = { forceNew: false }) {
    if (!consoleInstance || forceNew) {
      consoleInstance = new Console();
    }
    return consoleInstance;
  }
  addMessage(text, level, show) {
    const message = new Message(text, level || MessageLevel.Info, Date.now(), show || false);
    this.#messagesInternal.push(message);
    this.dispatchEventToListeners(Events.MessageAdded, message);
  }
  log(text) {
    this.addMessage(text, MessageLevel.Info);
  }
  warn(text) {
    this.addMessage(text, MessageLevel.Warning);
  }
  error(text) {
    this.addMessage(text, MessageLevel.Error, true);
  }
  messages() {
    return this.#messagesInternal;
  }
  show() {
    void this.showPromise();
  }
  showPromise() {
    return reveal(this);
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["MessageAdded"] = "messageAdded";
  return Events2;
})(Events || {});
export var MessageLevel = /* @__PURE__ */ ((MessageLevel2) => {
  MessageLevel2["Info"] = "info";
  MessageLevel2["Warning"] = "warning";
  MessageLevel2["Error"] = "error";
  return MessageLevel2;
})(MessageLevel || {});
export class Message {
  text;
  level;
  timestamp;
  show;
  constructor(text, level, timestamp, show) {
    this.text = text;
    this.level = level;
    this.timestamp = typeof timestamp === "number" ? timestamp : Date.now();
    this.show = show;
  }
}
//# sourceMappingURL=Console.js.map
