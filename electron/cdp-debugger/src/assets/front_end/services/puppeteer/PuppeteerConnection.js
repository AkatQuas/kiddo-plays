import * as puppeteer from "../../third_party/puppeteer/puppeteer.js";
export class Transport {
  #connection;
  #knownIds = /* @__PURE__ */ new Set();
  constructor(connection) {
    this.#connection = connection;
  }
  send(message) {
    const data = JSON.parse(message);
    this.#knownIds.add(data.id);
    this.#connection.sendRawMessage(JSON.stringify(data));
  }
  close() {
    void this.#connection.disconnect();
  }
  set onmessage(cb) {
    this.#connection.setOnMessage((message) => {
      if (!cb) {
        return;
      }
      const data = message;
      if (data.id && !this.#knownIds.has(data.id)) {
        return;
      }
      this.#knownIds.delete(data.id);
      if (!data.sessionId) {
        return;
      }
      return cb(JSON.stringify({
        ...data,
        sessionId: data.sessionId === this.#connection.getSessionId() ? void 0 : data.sessionId
      }));
    });
  }
  set onclose(cb) {
    const prev = this.#connection.getOnDisconnect();
    this.#connection.setOnDisconnect((reason) => {
      if (prev) {
        prev(reason);
      }
      if (cb) {
        cb();
      }
    });
  }
}
export class PuppeteerConnection extends puppeteer.Connection {
  async _onMessage(message) {
    const msgObj = JSON.parse(message);
    if (msgObj.sessionId && !this._sessions.has(msgObj.sessionId)) {
      return;
    }
    void super._onMessage(message);
  }
}
export async function getPuppeteerConnection(rawConnection, mainFrameId, mainTargetId) {
  const transport = new Transport(rawConnection);
  const connection = new PuppeteerConnection("", transport);
  const targetFilterCallback = (targetInfo) => {
    if (targetInfo.type !== "page" && targetInfo.type !== "iframe") {
      return false;
    }
    return targetInfo.targetId === mainTargetId || targetInfo.openerId === mainTargetId || targetInfo.type === "iframe";
  };
  const browser = await puppeteer.Browser.create(connection, [], false, void 0, void 0, void 0, targetFilterCallback);
  const pages = await browser.pages();
  const page = pages.find((p) => p.mainFrame()._id === mainFrameId) || null;
  return { page, browser };
}
//# sourceMappingURL=PuppeteerConnection.js.map
