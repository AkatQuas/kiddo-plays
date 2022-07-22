import * as Common from "../../core/common/common.js";
import { ChunkedFileReader } from "./FileUtils.js";
export class TempFile {
  #lastBlob;
  constructor() {
    this.#lastBlob = null;
  }
  write(pieces) {
    if (this.#lastBlob) {
      pieces.unshift(this.#lastBlob);
    }
    this.#lastBlob = new Blob(pieces, { type: "text/plain" });
  }
  read() {
    return this.readRange();
  }
  size() {
    return this.#lastBlob ? this.#lastBlob.size : 0;
  }
  async readRange(startOffset, endOffset) {
    if (!this.#lastBlob) {
      Common.Console.Console.instance().error("Attempt to read a temp file that was never written");
      return "";
    }
    const blob = typeof startOffset === "number" || typeof endOffset === "number" ? this.#lastBlob.slice(startOffset, endOffset) : this.#lastBlob;
    const reader = new FileReader();
    try {
      await new Promise((resolve, reject) => {
        reader.onloadend = resolve;
        reader.onerror = reject;
        reader.readAsText(blob);
      });
    } catch (error) {
      Common.Console.Console.instance().error("Failed to read from temp file: " + error.message);
    }
    return reader.result;
  }
  async copyToOutputStream(outputStream, progress) {
    if (!this.#lastBlob) {
      void outputStream.close();
      return null;
    }
    const reader = new ChunkedFileReader(this.#lastBlob, 10 * 1e3 * 1e3, progress);
    return reader.read(outputStream).then((success) => success ? null : reader.error());
  }
  remove() {
    this.#lastBlob = null;
  }
}
export class TempFileBackingStorage {
  #file;
  #strings;
  #stringsLength;
  constructor() {
    this.#file = null;
    this.reset();
  }
  appendString(string) {
    this.#strings.push(string);
    this.#stringsLength += string.length;
    const flushStringLength = 10 * 1024 * 1024;
    if (this.#stringsLength > flushStringLength) {
      this.flush();
    }
  }
  appendAccessibleString(string) {
    this.flush();
    if (!this.#file) {
      return async () => null;
    }
    const startOffset = this.#file.size();
    this.#strings.push(string);
    this.flush();
    return this.#file.readRange.bind(this.#file, startOffset, this.#file.size());
  }
  flush() {
    if (!this.#strings.length) {
      return;
    }
    if (!this.#file) {
      this.#file = new TempFile();
    }
    this.#stringsLength = 0;
    this.#file.write(this.#strings.splice(0));
  }
  finishWriting() {
    this.flush();
  }
  reset() {
    if (this.#file) {
      this.#file.remove();
    }
    this.#file = null;
    this.#strings = [];
    this.#stringsLength = 0;
  }
  writeToStream(outputStream) {
    return this.#file ? this.#file.copyToOutputStream(outputStream) : Promise.resolve(null);
  }
}
//# sourceMappingURL=TempFile.js.map
