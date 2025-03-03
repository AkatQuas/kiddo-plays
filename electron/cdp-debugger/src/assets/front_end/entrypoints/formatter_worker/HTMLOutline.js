import * as Platform from "../../core/platform/platform.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import { javaScriptOutline } from "./JavaScriptOutline.js";
export function htmlOutline(content, chunkCallback) {
  const SCRIPT_OPENING_TAG = /<script[^>]*>/im;
  const SCRIPT_CLOSING_TAG = /<\/script\s*>/im;
  const textCursor = new TextUtils.TextCursor.TextCursor(Platform.StringUtilities.findLineEndingIndexes(content));
  while (true) {
    const openingMatch = SCRIPT_OPENING_TAG.exec(content.substring(textCursor.offset()));
    if (!openingMatch) {
      break;
    }
    const scriptStart = textCursor.offset() + openingMatch.index + openingMatch[0].length;
    textCursor.advance(scriptStart);
    const scriptLine = textCursor.lineNumber();
    const scriptColumn = textCursor.columnNumber();
    const closingMatch = SCRIPT_CLOSING_TAG.exec(content.substring(textCursor.offset()));
    if (!closingMatch) {
      break;
    }
    const scriptEnd = textCursor.offset() + closingMatch.index;
    textCursor.advance(scriptEnd + closingMatch[0].length);
    const scriptContent = content.substring(scriptStart, scriptEnd);
    javaScriptOutline(scriptContent, ({ chunk }) => {
      chunk.forEach((item) => {
        if (item.line === 0) {
          item.column += scriptColumn;
        }
        item.line += scriptLine;
      });
      chunkCallback({ chunk, isLastChunk: false });
    });
  }
  chunkCallback({ chunk: [], isLastChunk: true });
}
//# sourceMappingURL=HTMLOutline.js.map
