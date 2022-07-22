import * as Common from "../../../../core/common/common.js";
import * as i18n from "../../../../core/i18n/i18n.js";
import * as Bindings from "../../../../models/bindings/bindings.js";
import * as UI from "../../legacy.js";
import { Linkifier } from "./Linkifier.js";
import jsUtilsStyles from "./jsUtils.css.js";
const UIStrings = {
  removeFromIgnore: "Remove from ignore list",
  addToIgnore: "Add script to ignore list",
  showSMoreFrames: "{n, plural, =1 {Show # more frame} other {Show # more frames}}",
  unknownSource: "unknown"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/utils/JSPresentationUtils.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
function populateContextMenu(link, event) {
  const contextMenu = new UI.ContextMenu.ContextMenu(event);
  event.consume(true);
  const uiLocation = Linkifier.uiLocation(link);
  if (uiLocation && Bindings.IgnoreListManager.IgnoreListManager.instance().canIgnoreListUISourceCode(uiLocation.uiSourceCode)) {
    if (Bindings.IgnoreListManager.IgnoreListManager.instance().isIgnoreListedUISourceCode(uiLocation.uiSourceCode)) {
      contextMenu.debugSection().appendItem(i18nString(UIStrings.removeFromIgnore), () => Bindings.IgnoreListManager.IgnoreListManager.instance().unIgnoreListUISourceCode(uiLocation.uiSourceCode));
    } else {
      contextMenu.debugSection().appendItem(i18nString(UIStrings.addToIgnore), () => Bindings.IgnoreListManager.IgnoreListManager.instance().ignoreListUISourceCode(uiLocation.uiSourceCode));
    }
  }
  contextMenu.appendApplicableItems(event);
  void contextMenu.show();
}
export function buildStackTraceRows(stackTrace, target, linkifier, tabStops, updateCallback) {
  const stackTraceRows = [];
  let regularRowCount = 0;
  if (updateCallback) {
    const throttler = new Common.Throttler.Throttler(100);
    linkifier.setLiveLocationUpdateCallback(() => throttler.schedule(async () => updateHiddenRows(updateCallback, stackTraceRows)));
  }
  function buildStackTraceRowsHelper(stackTrace2, previousCallFrames2 = void 0) {
    let asyncRow = null;
    if (previousCallFrames2) {
      asyncRow = {
        asyncDescription: UI.UIUtils.asyncStackTraceLabel(stackTrace2.description, previousCallFrames2),
        ignoreListHide: false,
        rowCountHide: false
      };
      stackTraceRows.push(asyncRow);
    }
    let hiddenCallFrames = 0;
    for (const stackFrame of stackTrace2.callFrames) {
      regularRowCount++;
      const rowCountHide = regularRowCount > 30 && stackTrace2.callFrames.length > 31;
      let ignoreListHide = false;
      const functionName = UI.UIUtils.beautifyFunctionName(stackFrame.functionName);
      const link = linkifier.maybeLinkifyConsoleCallFrame(target, stackFrame, { tabStop: Boolean(tabStops), inlineFrameIndex: 0 });
      if (link) {
        link.addEventListener("contextmenu", populateContextMenu.bind(null, link));
        const uiLocation = Linkifier.uiLocation(link);
        if (uiLocation && Bindings.IgnoreListManager.IgnoreListManager.instance().isIgnoreListedUISourceCode(uiLocation.uiSourceCode)) {
          ignoreListHide = true;
        }
        if (!link.textContent || link.textContent === "\u200B") {
          link.textContent = i18nString(UIStrings.unknownSource);
        }
      }
      if (rowCountHide || ignoreListHide) {
        ++hiddenCallFrames;
      }
      stackTraceRows.push({ functionName, link, ignoreListHide, rowCountHide });
    }
    if (asyncRow && hiddenCallFrames > 0 && hiddenCallFrames === stackTrace2.callFrames.length) {
      stackTraceRows[1].rowCountHide ? asyncRow.rowCountHide = true : asyncRow.ignoreListHide = true;
    }
  }
  buildStackTraceRowsHelper(stackTrace);
  let previousCallFrames = stackTrace.callFrames;
  for (let asyncStackTrace = stackTrace.parent; asyncStackTrace; asyncStackTrace = asyncStackTrace.parent) {
    if (asyncStackTrace.callFrames.length) {
      buildStackTraceRowsHelper(asyncStackTrace, previousCallFrames);
    }
    previousCallFrames = asyncStackTrace.callFrames;
  }
  return stackTraceRows;
}
function updateHiddenRows(renderCallback, stackTraceRows) {
  let shouldHideSubCount = 0;
  let indexOfAsyncRow = stackTraceRows.length;
  for (let i = stackTraceRows.length - 1; i >= 0; i--) {
    const row = stackTraceRows[i];
    if ("link" in row && row.link) {
      const uiLocation = Linkifier.uiLocation(row.link);
      if (uiLocation && Bindings.IgnoreListManager.IgnoreListManager.instance().isIgnoreListedUISourceCode(uiLocation.uiSourceCode)) {
        row.ignoreListHide = true;
      }
      if (row.rowCountHide || row.ignoreListHide) {
        shouldHideSubCount++;
      }
    }
    if ("asyncDescription" in row) {
      if (shouldHideSubCount > 0 && shouldHideSubCount === indexOfAsyncRow - i - 1) {
        stackTraceRows[i + 1].rowCountHide ? row.rowCountHide = true : row.ignoreListHide = true;
      }
      indexOfAsyncRow = i;
      shouldHideSubCount = 0;
    }
  }
  renderCallback(stackTraceRows);
}
export function buildStackTracePreviewContents(target, linkifier, options = {
  stackTrace: void 0,
  tabStops: void 0
}) {
  const { stackTrace, tabStops } = options;
  const element = document.createElement("span");
  element.classList.add("monospace");
  element.style.display = "inline-block";
  const shadowRoot = UI.Utils.createShadowRootWithCoreStyles(element, { cssFile: [jsUtilsStyles], delegatesFocus: void 0 });
  const contentElement = shadowRoot.createChild("table", "stack-preview-container");
  if (!stackTrace) {
    return { element, links: [] };
  }
  const updateCallback = renderStackTraceTable.bind(null, contentElement);
  const stackTraceRows = buildStackTraceRows(stackTrace, target, linkifier, tabStops, updateCallback);
  const links = renderStackTraceTable(contentElement, stackTraceRows);
  return { element, links };
}
function renderStackTraceTable(container, stackTraceRows) {
  container.removeChildren();
  let hiddenCallFramesCount = 0;
  const links = [];
  for (const item of stackTraceRows) {
    const row = container.createChild("tr");
    if ("asyncDescription" in item) {
      row.createChild("td").textContent = "\n";
      row.createChild("td", "stack-preview-async-description").textContent = item.asyncDescription;
      row.createChild("td");
      row.createChild("td");
    } else {
      row.createChild("td").textContent = "\n";
      row.createChild("td", "function-name").textContent = item.functionName;
      row.createChild("td").textContent = " @ ";
      if (item.link) {
        row.createChild("td").appendChild(item.link);
        links.push(item.link);
      }
      if (item.rowCountHide || item.ignoreListHide) {
        ++hiddenCallFramesCount;
      }
    }
    if (item.rowCountHide || item.ignoreListHide) {
      row.classList.add("hidden-row");
    }
    container.appendChild(row);
  }
  if (hiddenCallFramesCount) {
    const showAllRow = container.createChild("tr", "show-all-link");
    showAllRow.createChild("td").textContent = "\n";
    const cell = showAllRow.createChild("td");
    cell.colSpan = 4;
    const showAllLink = cell.createChild("span", "link");
    showAllLink.textContent = i18nString(UIStrings.showSMoreFrames, { n: hiddenCallFramesCount });
    showAllLink.addEventListener("click", () => {
      container.classList.add("show-hidden-rows");
    }, false);
  }
  return links;
}
//# sourceMappingURL=JSPresentationUtils.js.map
