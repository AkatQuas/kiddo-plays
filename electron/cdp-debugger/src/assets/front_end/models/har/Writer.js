import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import { Log } from "./Log.js";
const UIStrings = {
  collectingContent: "Collecting content\u2026",
  writingFile: "Writing file\u2026"
};
const str_ = i18n.i18n.registerUIStrings("models/har/Writer.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class Writer {
  static async write(stream, requests, progress) {
    const compositeProgress = new Common.Progress.CompositeProgress(progress);
    const content = await Writer.harStringForRequests(requests, compositeProgress);
    if (progress.isCanceled()) {
      return;
    }
    await Writer.writeToStream(stream, compositeProgress, content);
  }
  static async harStringForRequests(requests, compositeProgress) {
    const progress = compositeProgress.createSubProgress();
    progress.setTitle(i18nString(UIStrings.collectingContent));
    progress.setTotalWork(requests.length);
    requests.sort((reqA, reqB) => reqA.issueTime() - reqB.issueTime());
    const harLog = await Log.build(requests);
    const promises = [];
    for (let i = 0; i < requests.length; i++) {
      const promise = requests[i].contentData();
      promises.push(promise.then(contentLoaded.bind(null, harLog.entries[i])));
    }
    await Promise.all(promises);
    progress.done();
    if (progress.isCanceled()) {
      return "";
    }
    return JSON.stringify({ log: harLog }, null, jsonIndent);
    function isValidCharacter(codePoint) {
      return codePoint < 55296 || codePoint >= 57344 && codePoint < 64976 || codePoint > 65007 && codePoint <= 1114111 && (codePoint & 65534) !== 65534;
    }
    function needsEncoding(content) {
      for (let i = 0; i < content.length; i++) {
        if (!isValidCharacter(content.charCodeAt(i))) {
          return true;
        }
      }
      return false;
    }
    function contentLoaded(entry, contentData) {
      progress.incrementWorked();
      let encoded = contentData.encoded;
      if (contentData.content !== null) {
        let content = contentData.content;
        if (content && !encoded && needsEncoding(content)) {
          content = Platform.StringUtilities.toBase64(content);
          encoded = true;
        }
        entry.response.content.text = content;
      }
      if (encoded) {
        entry.response.content.encoding = "base64";
      }
    }
  }
  static async writeToStream(stream, compositeProgress, fileContent) {
    const progress = compositeProgress.createSubProgress();
    progress.setTitle(i18nString(UIStrings.writingFile));
    progress.setTotalWork(fileContent.length);
    for (let i = 0; i < fileContent.length && !progress.isCanceled(); i += chunkSize) {
      const chunk = fileContent.substr(i, chunkSize);
      await stream.write(chunk);
      progress.incrementWorked(chunk.length);
    }
    progress.done();
  }
}
export const jsonIndent = 2;
export const chunkSize = 1e5;
//# sourceMappingURL=Writer.js.map
