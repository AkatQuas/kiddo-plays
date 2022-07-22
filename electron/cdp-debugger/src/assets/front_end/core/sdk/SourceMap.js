import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as Common from "../common/common.js";
import * as i18n from "../i18n/i18n.js";
import * as Platform from "../platform/platform.js";
import { CompilerSourceMappingContentProvider } from "./CompilerSourceMappingContentProvider.js";
import { PageResourceLoader } from "./PageResourceLoader.js";
const UIStrings = {
  couldNotLoadContentForSS: "Could not load content for {PH1}: {PH2}",
  couldNotParseContentForSS: "Could not parse content for {PH1}: {PH2}"
};
const str_ = i18n.i18n.registerUIStrings("core/sdk/SourceMap.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class SourceMapV3 {
  version;
  file;
  sources;
  sections;
  mappings;
  sourceRoot;
  names;
  sourcesContent;
  constructor() {
  }
}
export class Section {
  map;
  offset;
  url;
  constructor() {
  }
}
export class Offset {
  line;
  column;
  constructor() {
  }
}
export class SourceMapEntry {
  lineNumber;
  columnNumber;
  sourceURL;
  sourceLineNumber;
  sourceColumnNumber;
  name;
  constructor(lineNumber, columnNumber, sourceURL, sourceLineNumber, sourceColumnNumber, name) {
    this.lineNumber = lineNumber;
    this.columnNumber = columnNumber;
    this.sourceURL = sourceURL;
    this.sourceLineNumber = sourceLineNumber;
    this.sourceColumnNumber = sourceColumnNumber;
    this.name = name;
  }
  static compare(entry1, entry2) {
    if (entry1.lineNumber !== entry2.lineNumber) {
      return entry1.lineNumber - entry2.lineNumber;
    }
    return entry1.columnNumber - entry2.columnNumber;
  }
}
const base64Digits = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const base64Map = /* @__PURE__ */ new Map();
for (let i = 0; i < base64Digits.length; ++i) {
  base64Map.set(base64Digits.charAt(i), i);
}
const sourceMapToSourceList = /* @__PURE__ */ new WeakMap();
export class TextSourceMap {
  #initiator;
  #json;
  #compiledURLInternal;
  #sourceMappingURL;
  #baseURL;
  #mappingsInternal;
  #sourceInfos;
  constructor(compiledURL, sourceMappingURL, payload, initiator) {
    this.#initiator = initiator;
    this.#json = payload;
    this.#compiledURLInternal = compiledURL;
    this.#sourceMappingURL = sourceMappingURL;
    this.#baseURL = sourceMappingURL.startsWith("data:") ? compiledURL : sourceMappingURL;
    this.#mappingsInternal = null;
    this.#sourceInfos = /* @__PURE__ */ new Map();
    if (this.#json.sections) {
      const sectionWithURL = Boolean(this.#json.sections.find((section) => Boolean(section.url)));
      if (sectionWithURL) {
        Common.Console.Console.instance().warn(`SourceMap "${sourceMappingURL}" contains unsupported "URL" field in one of its sections.`);
      }
    }
    this.eachSection(this.parseSources.bind(this));
  }
  static async load(sourceMapURL, compiledURL, initiator) {
    let updatedContent;
    try {
      const { content } = await PageResourceLoader.instance().loadResource(sourceMapURL, initiator);
      updatedContent = content;
      if (content.slice(0, 3) === ")]}") {
        updatedContent = content.substring(content.indexOf("\n"));
      }
    } catch (error) {
      throw new Error(i18nString(UIStrings.couldNotLoadContentForSS, { PH1: sourceMapURL, PH2: error.message }));
    }
    try {
      const payload = JSON.parse(updatedContent);
      return new TextSourceMap(compiledURL, sourceMapURL, payload, initiator);
    } catch (error) {
      throw new Error(i18nString(UIStrings.couldNotParseContentForSS, { PH1: sourceMapURL, PH2: error.message }));
    }
  }
  compiledURL() {
    return this.#compiledURLInternal;
  }
  url() {
    return this.#sourceMappingURL;
  }
  sourceURLs() {
    return [...this.#sourceInfos.keys()];
  }
  sourceContentProvider(sourceURL, contentType) {
    const info = this.#sourceInfos.get(sourceURL);
    if (info && info.content) {
      return TextUtils.StaticContentProvider.StaticContentProvider.fromString(sourceURL, contentType, info.content);
    }
    return new CompilerSourceMappingContentProvider(sourceURL, contentType, this.#initiator);
  }
  embeddedContentByURL(sourceURL) {
    const entry = this.#sourceInfos.get(sourceURL);
    if (!entry) {
      return null;
    }
    return entry.content;
  }
  findEntry(lineNumber, columnNumber) {
    const mappings = this.mappings();
    const index = Platform.ArrayUtilities.upperBound(mappings, void 0, (unused, entry) => lineNumber - entry.lineNumber || columnNumber - entry.columnNumber);
    return index ? mappings[index - 1] : null;
  }
  findEntryRanges(lineNumber, columnNumber) {
    const mappings = this.mappings();
    const index = Platform.ArrayUtilities.upperBound(mappings, void 0, (unused, entry) => lineNumber - entry.lineNumber || columnNumber - entry.columnNumber);
    if (!index) {
      return null;
    }
    const sourceURL = mappings[index].sourceURL;
    if (!sourceURL) {
      return null;
    }
    const endLine = index < mappings.length ? mappings[index].lineNumber : 2 ** 31 - 1;
    const endColumn = index < mappings.length ? mappings[index].columnNumber : 2 ** 31 - 1;
    const range = new TextUtils.TextRange.TextRange(mappings[index - 1].lineNumber, mappings[index - 1].columnNumber, endLine, endColumn);
    const reverseMappings = this.reversedMappings(sourceURL);
    const startSourceLine = mappings[index - 1].sourceLineNumber;
    const startSourceColumn = mappings[index - 1].sourceColumnNumber;
    const endReverseIndex = Platform.ArrayUtilities.upperBound(reverseMappings, void 0, (unused, i) => startSourceLine - mappings[i].sourceLineNumber || startSourceColumn - mappings[i].sourceColumnNumber);
    if (!endReverseIndex) {
      return null;
    }
    const endSourceLine = endReverseIndex < reverseMappings.length ? mappings[reverseMappings[endReverseIndex]].sourceLineNumber : 2 ** 31 - 1;
    const endSourceColumn = endReverseIndex < reverseMappings.length ? mappings[reverseMappings[endReverseIndex]].sourceColumnNumber : 2 ** 31 - 1;
    const sourceRange = new TextUtils.TextRange.TextRange(startSourceLine, startSourceColumn, endSourceLine, endSourceColumn);
    return { range, sourceRange, sourceURL };
  }
  sourceLineMapping(sourceURL, lineNumber, columnNumber) {
    const mappings = this.mappings();
    const reverseMappings = this.reversedMappings(sourceURL);
    const first = Platform.ArrayUtilities.lowerBound(reverseMappings, lineNumber, lineComparator);
    const last = Platform.ArrayUtilities.upperBound(reverseMappings, lineNumber, lineComparator);
    if (first >= reverseMappings.length || mappings[reverseMappings[first]].sourceLineNumber !== lineNumber) {
      return null;
    }
    const columnMappings = reverseMappings.slice(first, last);
    if (!columnMappings.length) {
      return null;
    }
    const index = Platform.ArrayUtilities.lowerBound(columnMappings, columnNumber, (columnNumber2, i) => columnNumber2 - mappings[i].sourceColumnNumber);
    return index >= columnMappings.length ? mappings[columnMappings[columnMappings.length - 1]] : mappings[columnMappings[index]];
    function lineComparator(lineNumber2, i) {
      return lineNumber2 - mappings[i].sourceLineNumber;
    }
  }
  findReverseIndices(sourceURL, lineNumber, columnNumber) {
    const mappings = this.mappings();
    const reverseMappings = this.reversedMappings(sourceURL);
    const endIndex = Platform.ArrayUtilities.upperBound(reverseMappings, void 0, (unused, i) => lineNumber - mappings[i].sourceLineNumber || columnNumber - mappings[i].sourceColumnNumber);
    let startIndex = endIndex;
    while (startIndex > 0 && mappings[reverseMappings[startIndex - 1]].sourceLineNumber === mappings[reverseMappings[endIndex - 1]].sourceLineNumber && mappings[reverseMappings[startIndex - 1]].sourceColumnNumber === mappings[reverseMappings[endIndex - 1]].sourceColumnNumber) {
      --startIndex;
    }
    return reverseMappings.slice(startIndex, endIndex);
  }
  findReverseEntries(sourceURL, lineNumber, columnNumber) {
    const mappings = this.mappings();
    return this.findReverseIndices(sourceURL, lineNumber, columnNumber).map((i) => mappings[i]);
  }
  findReverseRanges(sourceURL, lineNumber, columnNumber) {
    const mappings = this.mappings();
    const indices = this.findReverseIndices(sourceURL, lineNumber, columnNumber);
    const ranges = [];
    for (let i = 0; i < indices.length; ++i) {
      const startIndex = indices[i];
      let endIndex = startIndex + 1;
      while (i + 1 < indices.length && endIndex === indices[i + 1]) {
        ++endIndex;
        ++i;
      }
      const startLine = mappings[startIndex].lineNumber;
      const startColumn = mappings[startIndex].columnNumber;
      const endLine = endIndex < mappings.length ? mappings[endIndex].lineNumber : 2 ** 31 - 1;
      const endColumn = endIndex < mappings.length ? mappings[endIndex].columnNumber : 2 ** 31 - 1;
      ranges.push(new TextUtils.TextRange.TextRange(startLine, startColumn, endLine, endColumn));
    }
    return ranges;
  }
  mappings() {
    this.#ensureMappingsProcessed();
    return this.#mappingsInternal ?? [];
  }
  reversedMappings(sourceURL) {
    this.#ensureMappingsProcessed();
    return this.#sourceInfos.get(sourceURL)?.reverseMappings ?? [];
  }
  #ensureMappingsProcessed() {
    if (this.#mappingsInternal === null) {
      this.#mappingsInternal = [];
      this.eachSection(this.parseMap.bind(this));
      this.#computeReverseMappings(this.#mappingsInternal);
      this.#json = null;
    }
  }
  #computeReverseMappings(mappings) {
    const reverseMappingsPerUrl = /* @__PURE__ */ new Map();
    for (let i = 0; i < mappings.length; i++) {
      const entryUrl = mappings[i].sourceURL;
      if (!entryUrl) {
        continue;
      }
      let reverseMap = reverseMappingsPerUrl.get(entryUrl);
      if (!reverseMap) {
        reverseMap = [];
        reverseMappingsPerUrl.set(entryUrl, reverseMap);
      }
      reverseMap.push(i);
    }
    for (const [url, reverseMap] of reverseMappingsPerUrl.entries()) {
      const info = this.#sourceInfos.get(url);
      if (!info) {
        continue;
      }
      reverseMap.sort(sourceMappingComparator);
      info.reverseMappings = reverseMap;
    }
    function sourceMappingComparator(indexA, indexB) {
      const a = mappings[indexA];
      const b = mappings[indexB];
      return a.sourceLineNumber - b.sourceLineNumber || a.sourceColumnNumber - b.sourceColumnNumber || a.lineNumber - b.lineNumber || a.columnNumber - b.columnNumber;
    }
  }
  eachSection(callback) {
    if (!this.#json) {
      return;
    }
    if (!this.#json.sections) {
      callback(this.#json, 0, 0);
      return;
    }
    for (const section of this.#json.sections) {
      callback(section.map, section.offset.line, section.offset.column);
    }
  }
  parseSources(sourceMap) {
    const sourcesList = [];
    const sourceRoot = sourceMap.sourceRoot || Platform.DevToolsPath.EmptyUrlString;
    for (let i = 0; i < sourceMap.sources.length; ++i) {
      let href = sourceMap.sources[i];
      if (Common.ParsedURL.ParsedURL.isRelativeURL(href)) {
        if (sourceRoot && !sourceRoot.endsWith("/") && href && !href.startsWith("/")) {
          href = Common.ParsedURL.ParsedURL.concatenate(sourceRoot, "/", href);
        } else {
          href = Common.ParsedURL.ParsedURL.concatenate(sourceRoot, href);
        }
      }
      let url = Common.ParsedURL.ParsedURL.completeURL(this.#baseURL, href) || href;
      const source = sourceMap.sourcesContent && sourceMap.sourcesContent[i];
      if (url === this.#compiledURLInternal && source) {
        url = Common.ParsedURL.ParsedURL.concatenate(url, "? [sm]");
      }
      sourcesList.push(url);
      if (!this.#sourceInfos.has(url)) {
        this.#sourceInfos.set(url, new TextSourceMap.SourceInfo(source ?? null));
      }
    }
    sourceMapToSourceList.set(sourceMap, sourcesList);
  }
  parseMap(map, lineNumber, columnNumber) {
    let sourceIndex = 0;
    let sourceLineNumber = 0;
    let sourceColumnNumber = 0;
    let nameIndex = 0;
    const sources = sourceMapToSourceList.get(map);
    const names = map.names || [];
    const stringCharIterator = new TextSourceMap.StringCharIterator(map.mappings);
    let sourceURL = sources && sources[sourceIndex];
    while (true) {
      if (stringCharIterator.peek() === ",") {
        stringCharIterator.next();
      } else {
        while (stringCharIterator.peek() === ";") {
          lineNumber += 1;
          columnNumber = 0;
          stringCharIterator.next();
        }
        if (!stringCharIterator.hasNext()) {
          break;
        }
      }
      columnNumber += this.decodeVLQ(stringCharIterator);
      if (!stringCharIterator.hasNext() || this.isSeparator(stringCharIterator.peek())) {
        this.mappings().push(new SourceMapEntry(lineNumber, columnNumber));
        continue;
      }
      const sourceIndexDelta = this.decodeVLQ(stringCharIterator);
      if (sourceIndexDelta) {
        sourceIndex += sourceIndexDelta;
        if (sources) {
          sourceURL = sources[sourceIndex];
        }
      }
      sourceLineNumber += this.decodeVLQ(stringCharIterator);
      sourceColumnNumber += this.decodeVLQ(stringCharIterator);
      if (!stringCharIterator.hasNext() || this.isSeparator(stringCharIterator.peek())) {
        this.mappings().push(new SourceMapEntry(lineNumber, columnNumber, sourceURL, sourceLineNumber, sourceColumnNumber));
        continue;
      }
      nameIndex += this.decodeVLQ(stringCharIterator);
      this.mappings().push(new SourceMapEntry(lineNumber, columnNumber, sourceURL, sourceLineNumber, sourceColumnNumber, names[nameIndex]));
    }
    this.mappings().sort(SourceMapEntry.compare);
  }
  isSeparator(char) {
    return char === "," || char === ";";
  }
  decodeVLQ(stringCharIterator) {
    let result = 0;
    let shift = 0;
    let digit = TextSourceMap._VLQ_CONTINUATION_MASK;
    while (digit & TextSourceMap._VLQ_CONTINUATION_MASK) {
      digit = base64Map.get(stringCharIterator.next()) || 0;
      result += (digit & TextSourceMap._VLQ_BASE_MASK) << shift;
      shift += TextSourceMap._VLQ_BASE_SHIFT;
    }
    const negative = result & 1;
    result >>= 1;
    return negative ? -result : result;
  }
  reverseMapTextRange(url, textRange) {
    function comparator(position, mappingIndex) {
      if (position.lineNumber !== mappings[mappingIndex].sourceLineNumber) {
        return position.lineNumber - mappings[mappingIndex].sourceLineNumber;
      }
      return position.columnNumber - mappings[mappingIndex].sourceColumnNumber;
    }
    const reverseMappings = this.reversedMappings(url);
    const mappings = this.mappings();
    if (!reverseMappings.length) {
      return null;
    }
    const startIndex = Platform.ArrayUtilities.lowerBound(reverseMappings, { lineNumber: textRange.startLine, columnNumber: textRange.startColumn }, comparator);
    const endIndex = Platform.ArrayUtilities.upperBound(reverseMappings, { lineNumber: textRange.endLine, columnNumber: textRange.endColumn }, comparator);
    if (endIndex >= reverseMappings.length) {
      return null;
    }
    const startMapping = mappings[reverseMappings[startIndex]];
    const endMapping = mappings[reverseMappings[endIndex]];
    return new TextUtils.TextRange.TextRange(startMapping.lineNumber, startMapping.columnNumber, endMapping.lineNumber, endMapping.columnNumber);
  }
  mapsOrigin() {
    const mappings = this.mappings();
    if (mappings.length > 0) {
      const firstEntry = mappings[0];
      return firstEntry?.lineNumber === 0 || firstEntry.columnNumber === 0;
    }
    return false;
  }
}
((TextSourceMap2) => {
  TextSourceMap2._VLQ_BASE_SHIFT = 5;
  TextSourceMap2._VLQ_BASE_MASK = (1 << 5) - 1;
  TextSourceMap2._VLQ_CONTINUATION_MASK = 1 << 5;
  class StringCharIterator {
    string;
    position;
    constructor(string) {
      this.string = string;
      this.position = 0;
    }
    next() {
      return this.string.charAt(this.position++);
    }
    peek() {
      return this.string.charAt(this.position);
    }
    hasNext() {
      return this.position < this.string.length;
    }
  }
  TextSourceMap2.StringCharIterator = StringCharIterator;
  class SourceInfo {
    content;
    reverseMappings = null;
    constructor(content) {
      this.content = content;
    }
  }
  TextSourceMap2.SourceInfo = SourceInfo;
})(TextSourceMap || (TextSourceMap = {}));
//# sourceMappingURL=SourceMap.js.map
