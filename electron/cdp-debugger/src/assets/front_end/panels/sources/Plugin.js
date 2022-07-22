export class Plugin {
  constructor(uiSourceCode, _transformer) {
    this.uiSourceCode = uiSourceCode;
  }
  static accepts(_uiSourceCode) {
    return false;
  }
  willHide() {
  }
  async rightToolbarItems() {
    return [];
  }
  leftToolbarItems() {
    return [];
  }
  populateLineGutterContextMenu(_contextMenu, _lineNumber) {
  }
  populateTextAreaContextMenu(_contextMenu, _lineNumber, _columnNumber) {
  }
  decorationChanged(_type, _editor) {
  }
  editorExtension() {
    return [];
  }
  editorInitialized(_editor) {
  }
  dispose() {
  }
}
//# sourceMappingURL=Plugin.js.map
