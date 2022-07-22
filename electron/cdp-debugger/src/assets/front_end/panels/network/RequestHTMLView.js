import * as UI from "../../ui/legacy/legacy.js";
import requestHTMLViewStyles from "./requestHTMLView.css.js";
export class RequestHTMLView extends UI.Widget.VBox {
  dataURL;
  constructor(dataURL) {
    super(true);
    this.dataURL = encodeURI(dataURL).replace(/#/g, "%23");
    this.contentElement.classList.add("html", "request-view");
  }
  wasShown() {
    this.createIFrame();
    this.registerCSSFiles([requestHTMLViewStyles]);
  }
  willHide() {
    this.contentElement.removeChildren();
  }
  createIFrame() {
    this.contentElement.removeChildren();
    const iframe = document.createElement("iframe");
    iframe.className = "html-preview-frame";
    iframe.setAttribute("sandbox", "");
    iframe.setAttribute("csp", "default-src 'none'");
    iframe.setAttribute("src", this.dataURL);
    iframe.tabIndex = -1;
    UI.ARIAUtils.markAsPresentation(iframe);
    this.contentElement.appendChild(iframe);
  }
}
//# sourceMappingURL=RequestHTMLView.js.map
