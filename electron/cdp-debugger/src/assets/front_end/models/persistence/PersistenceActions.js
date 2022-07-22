import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Workspace from "../workspace/workspace.js";
import { NetworkPersistenceManager } from "./NetworkPersistenceManager.js";
import { PersistenceImpl } from "./PersistenceImpl.js";
const UIStrings = {
  saveAs: "Save as...",
  saveImage: "Save image",
  saveForOverrides: "Save for overrides",
  openInContainingFolder: "Open in containing folder"
};
const str_ = i18n.i18n.registerUIStrings("models/persistence/PersistenceActions.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
let contextMenuProviderInstance;
export class ContextMenuProvider {
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!contextMenuProviderInstance || forceNew) {
      contextMenuProviderInstance = new ContextMenuProvider();
    }
    return contextMenuProviderInstance;
  }
  appendApplicableItems(event, contextMenu, target) {
    const contentProvider = target;
    async function saveAs() {
      if (contentProvider instanceof Workspace.UISourceCode.UISourceCode) {
        contentProvider.commitWorkingCopy();
      }
      let content = (await contentProvider.requestContent()).content || "";
      if (await contentProvider.contentEncoded()) {
        content = window.atob(content);
      }
      const url = contentProvider.contentURL();
      void Workspace.FileManager.FileManager.instance().save(url, content, true);
      Workspace.FileManager.FileManager.instance().close(url);
    }
    async function saveImage() {
      const targetObject = contentProvider;
      const content = (await targetObject.requestContent()).content || "";
      const link = document.createElement("a");
      link.download = targetObject.displayName;
      link.href = "data:" + targetObject.mimeType + ";base64," + content;
      link.click();
    }
    if (contentProvider.contentType().isDocumentOrScriptOrStyleSheet()) {
      contextMenu.saveSection().appendItem(i18nString(UIStrings.saveAs), saveAs);
    } else if (contentProvider instanceof SDK.Resource.Resource && contentProvider.contentType().isImage()) {
      contextMenu.saveSection().appendItem(i18nString(UIStrings.saveImage), saveImage);
    }
    const uiSourceCode = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCodeForURL(contentProvider.contentURL());
    if (uiSourceCode && NetworkPersistenceManager.instance().canSaveUISourceCodeForOverrides(uiSourceCode)) {
      contextMenu.saveSection().appendItem(i18nString(UIStrings.saveForOverrides), () => {
        uiSourceCode.commitWorkingCopy();
        void NetworkPersistenceManager.instance().saveUISourceCodeForOverrides(uiSourceCode);
        void Common.Revealer.reveal(uiSourceCode);
      });
    }
    const binding = uiSourceCode && PersistenceImpl.instance().binding(uiSourceCode);
    const fileURL = binding ? binding.fileSystem.contentURL() : contentProvider.contentURL();
    if (fileURL.startsWith("file://")) {
      const path = Common.ParsedURL.ParsedURL.urlToRawPathString(fileURL, Host.Platform.isWin());
      contextMenu.revealSection().appendItem(i18nString(UIStrings.openInContainingFolder), () => Host.InspectorFrontendHost.InspectorFrontendHostInstance.showItemInFolder(path));
    }
  }
}
//# sourceMappingURL=PersistenceActions.js.map
