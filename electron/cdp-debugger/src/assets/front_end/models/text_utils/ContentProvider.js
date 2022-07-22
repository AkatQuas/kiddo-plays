export class ContentProvider {
}
export class SearchMatch {
  constructor(lineNumber, lineContent, columnNumber) {
    this.lineNumber = lineNumber;
    this.lineContent = lineContent;
    this.columnNumber = columnNumber;
  }
}
export const contentAsDataURL = function(content, mimeType, contentEncoded, charset, limitSize = true) {
  const maxDataUrlSize = 1024 * 1024;
  if (content === void 0 || content === null || limitSize && content.length > maxDataUrlSize) {
    return null;
  }
  return "data:" + mimeType + (charset ? ";charset=" + charset : "") + (contentEncoded ? ";base64" : "") + "," + content;
};
//# sourceMappingURL=ContentProvider.js.map
