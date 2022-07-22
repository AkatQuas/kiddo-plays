import * as Common from "../../core/common/common.js";
export function parseSourcePositionsFromErrorStack(runtimeModel, stack) {
  if (!/^[\w.]*Error\b/.test(stack)) {
    return null;
  }
  const debuggerModel = runtimeModel.debuggerModel();
  const baseURL = runtimeModel.target().inspectedURL();
  const lines = stack.split("\n");
  const linkInfos = [];
  for (const line of lines) {
    const isCallFrameLine = /^\s*at\s/.test(line);
    if (!isCallFrameLine && linkInfos.length && linkInfos[linkInfos.length - 1].link) {
      return null;
    }
    if (!isCallFrameLine) {
      linkInfos.push({ line });
      continue;
    }
    let openBracketIndex = -1;
    let closeBracketIndex = -1;
    const inBracketsWithLineAndColumn = /\([^\)\(]+:\d+:\d+\)/g;
    const inBrackets = /\([^\)\(]+\)/g;
    let lastMatch = null;
    let currentMatch;
    while (currentMatch = inBracketsWithLineAndColumn.exec(line)) {
      lastMatch = currentMatch;
    }
    if (!lastMatch) {
      while (currentMatch = inBrackets.exec(line)) {
        lastMatch = currentMatch;
      }
    }
    if (lastMatch) {
      openBracketIndex = lastMatch.index;
      closeBracketIndex = lastMatch.index + lastMatch[0].length - 1;
    }
    const hasOpenBracket = openBracketIndex !== -1;
    let left = hasOpenBracket ? openBracketIndex + 1 : line.indexOf("at") + 3;
    if (!hasOpenBracket && line.indexOf("async ") === left) {
      left += 6;
    }
    const right = hasOpenBracket ? closeBracketIndex : line.length;
    const linkCandidate = line.substring(left, right);
    const splitResult = Common.ParsedURL.ParsedURL.splitLineAndColumn(linkCandidate);
    if (splitResult.url === "<anonymous>") {
      linkInfos.push({ line });
      continue;
    }
    let url = parseOrScriptMatch(debuggerModel, splitResult.url);
    if (!url && Common.ParsedURL.ParsedURL.isRelativeURL(splitResult.url)) {
      url = parseOrScriptMatch(debuggerModel, Common.ParsedURL.ParsedURL.completeURL(baseURL, splitResult.url));
    }
    if (!url) {
      return null;
    }
    linkInfos.push({
      line,
      link: {
        url,
        prefix: line.substring(0, left),
        suffix: line.substring(right),
        enclosedInBraces: hasOpenBracket,
        lineNumber: splitResult.lineNumber,
        columnNumber: splitResult.columnNumber
      }
    });
  }
  return linkInfos;
}
function parseOrScriptMatch(debuggerModel, url) {
  if (!url) {
    return null;
  }
  if (Common.ParsedURL.ParsedURL.isValidUrlString(url)) {
    return url;
  }
  if (debuggerModel.scriptsForSourceURL(url).length) {
    return url;
  }
  const fileUrl = new URL(url, "file://");
  if (debuggerModel.scriptsForSourceURL(fileUrl.href).length) {
    return fileUrl.href;
  }
  return null;
}
export function augmentErrorStackWithScriptIds(parsedFrames, protocolStackTrace) {
  for (const parsedFrame of parsedFrames) {
    const protocolFrame = protocolStackTrace.callFrames.find((frame) => framesMatch(parsedFrame, frame));
    if (protocolFrame && parsedFrame.link) {
      parsedFrame.link.scriptId = protocolFrame.scriptId;
    }
  }
}
function framesMatch(parsedFrame, protocolFrame) {
  if (!parsedFrame.link) {
    return false;
  }
  const { url, lineNumber, columnNumber } = parsedFrame.link;
  return url === protocolFrame.url && lineNumber === protocolFrame.lineNumber && columnNumber === protocolFrame.columnNumber;
}
//# sourceMappingURL=ErrorStackParser.js.map
