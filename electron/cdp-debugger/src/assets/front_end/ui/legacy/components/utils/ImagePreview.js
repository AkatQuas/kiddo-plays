import * as Common from "../../../../core/common/common.js";
import * as Host from "../../../../core/host/host.js";
import * as i18n from "../../../../core/i18n/i18n.js";
import * as Platform from "../../../../core/platform/platform.js";
import * as SDK from "../../../../core/sdk/sdk.js";
import imagePreviewStyles from "./imagePreview.css.js";
const UIStrings = {
  unknownSource: "unknown source",
  imageFromS: "Image from {PH1}",
  fileSize: "File size:",
  intrinsicSize: "Intrinsic size:",
  renderedSize: "Rendered size:",
  currentSource: "Current source:",
  renderedAspectRatio: "Rendered aspect ratio:",
  intrinsicAspectRatio: "Intrinsic aspect ratio:"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/utils/ImagePreview.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
function isImageResource(resource) {
  return resource !== null && resource.resourceType() === Common.ResourceType.resourceTypes.Image;
}
export class ImagePreview {
  static async build(target, originalImageURL, showDimensions, options = { precomputedFeatures: void 0, imageAltText: void 0 }) {
    const { precomputedFeatures, imageAltText } = options;
    const resourceTreeModel = target.model(SDK.ResourceTreeModel.ResourceTreeModel);
    if (!resourceTreeModel) {
      return null;
    }
    let resource = resourceTreeModel.resourceForURL(originalImageURL);
    let imageURL = originalImageURL;
    if (!isImageResource(resource) && precomputedFeatures && precomputedFeatures.currentSrc) {
      imageURL = precomputedFeatures.currentSrc;
      resource = resourceTreeModel.resourceForURL(imageURL);
    }
    if (!resource || !isImageResource(resource)) {
      return null;
    }
    const imageResource = resource;
    const displayName = resource.displayName;
    const content = resource.content ? resource.content : resource.url.split("base64,")[1];
    const contentSize = resource.contentSize();
    const resourceSize = contentSize ? contentSize : Platform.StringUtilities.base64ToSize(content);
    const resourceSizeText = resourceSize > 0 ? Platform.NumberUtilities.bytesToString(resourceSize) : "";
    return new Promise((resolve) => {
      const imageElement = document.createElement("img");
      imageElement.addEventListener("load", buildContent, false);
      imageElement.addEventListener("error", () => resolve(null), false);
      if (imageAltText) {
        imageElement.alt = imageAltText;
      }
      void imageResource.populateImageSource(imageElement);
      function buildContent() {
        const shadowBoundary = document.createElement("div");
        const shadowRoot = shadowBoundary.attachShadow({ mode: "open" });
        shadowRoot.adoptedStyleSheets = [imagePreviewStyles];
        const container = shadowRoot.createChild("table");
        container.className = "image-preview-container";
        const imageRow = container.createChild("tr").createChild("td", "image-container");
        imageRow.colSpan = 2;
        const link = imageRow.createChild("div");
        link.title = displayName;
        link.appendChild(imageElement);
        link.addEventListener("click", () => {
          Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(imageURL);
        });
        const intrinsicWidth = imageElement.naturalWidth;
        const intrinsicHeight = imageElement.naturalHeight;
        const renderedWidth = precomputedFeatures ? precomputedFeatures.renderedWidth : intrinsicWidth;
        const renderedHeight = precomputedFeatures ? precomputedFeatures.renderedHeight : intrinsicHeight;
        if (showDimensions) {
          const renderedRow = container.createChild("tr", "row");
          renderedRow.createChild("td", "title").textContent = i18nString(UIStrings.renderedSize);
          renderedRow.createChild("td", "description").textContent = `${renderedWidth} \xD7 ${renderedHeight} px`;
          const aspectRatioRow = container.createChild("tr", "row");
          aspectRatioRow.createChild("td", "title").textContent = i18nString(UIStrings.renderedAspectRatio);
          aspectRatioRow.createChild("td", "description").textContent = Platform.NumberUtilities.aspectRatio(renderedWidth, renderedHeight);
          if (renderedHeight !== intrinsicHeight || renderedWidth !== intrinsicWidth) {
            const intrinsicRow = container.createChild("tr", "row");
            intrinsicRow.createChild("td", "title").textContent = i18nString(UIStrings.intrinsicSize);
            intrinsicRow.createChild("td", "description").textContent = `${intrinsicWidth} \xD7 ${intrinsicHeight} px`;
            const intrinsicAspectRatioRow = container.createChild("tr", "row");
            intrinsicAspectRatioRow.createChild("td", "title").textContent = i18nString(UIStrings.intrinsicAspectRatio);
            intrinsicAspectRatioRow.createChild("td", "description").textContent = Platform.NumberUtilities.aspectRatio(intrinsicWidth, intrinsicHeight);
          }
        }
        const fileRow = container.createChild("tr", "row");
        fileRow.createChild("td", "title").textContent = i18nString(UIStrings.fileSize);
        fileRow.createChild("td", "description").textContent = resourceSizeText;
        const originalRow = container.createChild("tr", "row");
        originalRow.createChild("td", "title").textContent = i18nString(UIStrings.currentSource);
        const sourceText = Platform.StringUtilities.trimMiddle(imageURL, 100);
        const sourceLink = originalRow.createChild("td", "description description-link").createChild("span", "source-link");
        sourceLink.textContent = sourceText;
        sourceLink.addEventListener("click", () => {
          Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(imageURL);
        });
        resolve(shadowBoundary);
      }
    });
  }
  static async loadDimensionsForNode(node) {
    if (!node.nodeName() || node.nodeName().toLowerCase() !== "img") {
      return;
    }
    const object = await node.resolveToObject("");
    if (!object) {
      return;
    }
    const featuresObject = await object.callFunctionJSON(features, void 0);
    object.release();
    return featuresObject;
    function features() {
      return {
        renderedWidth: this.width,
        renderedHeight: this.height,
        currentSrc: this.currentSrc
      };
    }
  }
  static defaultAltTextForImageURL(url) {
    const parsedImageURL = new Common.ParsedURL.ParsedURL(url);
    const imageSourceText = parsedImageURL.isValid ? parsedImageURL.displayName : i18nString(UIStrings.unknownSource);
    return i18nString(UIStrings.imageFromS, { PH1: imageSourceText });
  }
}
//# sourceMappingURL=ImagePreview.js.map
