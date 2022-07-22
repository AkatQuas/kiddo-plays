import * as Common from "../../core/common/common.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import layers3DViewStyles from "./layers3DView.css.js";
import * as UI from "../../ui/legacy/legacy.js";
import { LayerSelection, Selection, SnapshotSelection, Type, ScrollRectSelection } from "./LayerViewHost.js";
import { Events as TransformControllerEvents, TransformController } from "./TransformController.js";
const UIStrings = {
  layerInformationIsNotYet: "Layer information is not yet available.",
  dLayersView: "3D Layers View",
  cantDisplayLayers: "Can't display layers,",
  webglSupportIsDisabledInYour: "WebGL support is disabled in your browser.",
  checkSForPossibleReasons: "Check {PH1} for possible reasons.",
  slowScrollRects: "Slow scroll rects",
  paints: "Paints",
  resetView: "Reset View",
  showPaintProfiler: "Show Paint Profiler"
};
const str_ = i18n.i18n.registerUIStrings("panels/layer_viewer/Layers3DView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const vertexPositionAttributes = /* @__PURE__ */ new Map();
const vertexColorAttributes = /* @__PURE__ */ new Map();
const textureCoordAttributes = /* @__PURE__ */ new Map();
const uniformMatrixLocations = /* @__PURE__ */ new Map();
const uniformSamplerLocations = /* @__PURE__ */ new Map();
const imageForTexture = /* @__PURE__ */ new Map();
export class Layers3DView extends Common.ObjectWrapper.eventMixin(UI.Widget.VBox) {
  failBanner;
  layerViewHost;
  transformController;
  canvasElement;
  lastSelection;
  layerTree;
  textureManager;
  chromeTextures;
  rects;
  snapshotLayers;
  shaderProgram;
  oldTextureScale;
  depthByLayerId;
  visibleLayers;
  maxDepth;
  scale;
  layerTexture;
  projectionMatrix;
  whiteTexture;
  gl;
  dimensionsForAutoscale;
  needsUpdate;
  panelToolbar;
  showSlowScrollRectsSetting;
  showPaintsSetting;
  mouseDownX;
  mouseDownY;
  constructor(layerViewHost) {
    super(true);
    this.contentElement.classList.add("layers-3d-view");
    this.failBanner = new UI.Widget.VBox();
    this.failBanner.element.classList.add("full-widget-dimmed-banner");
    UI.UIUtils.createTextChild(this.failBanner.element, i18nString(UIStrings.layerInformationIsNotYet));
    this.layerViewHost = layerViewHost;
    this.layerViewHost.registerView(this);
    this.transformController = new TransformController(this.contentElement);
    this.transformController.addEventListener(TransformControllerEvents.TransformChanged, this.update, this);
    this.initToolbar();
    this.canvasElement = this.contentElement.createChild("canvas");
    this.canvasElement.tabIndex = 0;
    this.canvasElement.addEventListener("dblclick", this.onDoubleClick.bind(this), false);
    this.canvasElement.addEventListener("mousedown", this.onMouseDown.bind(this), false);
    this.canvasElement.addEventListener("mouseup", this.onMouseUp.bind(this), false);
    this.canvasElement.addEventListener("mouseleave", this.onMouseMove.bind(this), false);
    this.canvasElement.addEventListener("mousemove", this.onMouseMove.bind(this), false);
    this.canvasElement.addEventListener("contextmenu", this.onContextMenu.bind(this), false);
    UI.ARIAUtils.setAccessibleName(this.canvasElement, i18nString(UIStrings.dLayersView));
    this.lastSelection = {};
    this.layerTree = null;
    this.textureManager = new LayerTextureManager(this.update.bind(this));
    this.chromeTextures = [];
    this.rects = [];
    this.snapshotLayers = /* @__PURE__ */ new Map();
    this.layerViewHost.setLayerSnapshotMap(this.snapshotLayers);
    this.layerViewHost.showInternalLayersSetting().addChangeListener(this.update, this);
  }
  setLayerTree(layerTree) {
    this.layerTree = layerTree;
    this.layerTexture = null;
    delete this.oldTextureScale;
    if (this.showPaints()) {
      this.textureManager.setLayerTree(layerTree);
    }
    this.update();
  }
  showImageForLayer(layer, imageURL) {
    if (!imageURL) {
      this.layerTexture = null;
      this.update();
      return;
    }
    void UI.UIUtils.loadImage(imageURL).then((image) => {
      const texture = image && LayerTextureManager.createTextureForImage(this.gl || null, image);
      this.layerTexture = texture ? { layer, texture } : null;
      this.update();
    });
  }
  onResize() {
    this.resizeCanvas();
    this.update();
  }
  willHide() {
    this.textureManager.suspend();
  }
  wasShown() {
    this.textureManager.resume();
    this.registerCSSFiles([layers3DViewStyles]);
    if (!this.needsUpdate) {
      return;
    }
    this.resizeCanvas();
    this.update();
  }
  updateLayerSnapshot(layer) {
    this.textureManager.layerNeedsUpdate(layer);
  }
  setOutline(type, selection) {
    this.lastSelection[type] = selection;
    this.update();
  }
  hoverObject(selection) {
    this.setOutline(OutlineType.Hovered, selection);
  }
  selectObject(selection) {
    this.setOutline(OutlineType.Hovered, null);
    this.setOutline(OutlineType.Selected, selection);
  }
  snapshotForSelection(selection) {
    if (selection.type() === Type.Snapshot) {
      const snapshotWithRect = selection.snapshot();
      snapshotWithRect.snapshot.addReference();
      return Promise.resolve(snapshotWithRect);
    }
    if (selection.layer()) {
      const promise = selection.layer().snapshots()[0];
      if (promise !== void 0) {
        return promise;
      }
    }
    return Promise.resolve(null);
  }
  initGL(canvas) {
    const gl = canvas.getContext("webgl");
    if (!gl) {
      return null;
    }
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.DEPTH_TEST);
    return gl;
  }
  createShader(type, script) {
    if (!this.gl) {
      return;
    }
    const shader = this.gl.createShader(type);
    if (shader && this.shaderProgram) {
      this.gl.shaderSource(shader, script);
      this.gl.compileShader(shader);
      this.gl.attachShader(this.shaderProgram, shader);
    }
  }
  initShaders() {
    if (!this.gl) {
      return;
    }
    this.shaderProgram = this.gl.createProgram();
    if (!this.shaderProgram) {
      return;
    }
    this.createShader(this.gl.FRAGMENT_SHADER, FragmentShader);
    this.createShader(this.gl.VERTEX_SHADER, VertexShader);
    this.gl.linkProgram(this.shaderProgram);
    this.gl.useProgram(this.shaderProgram);
    const aVertexPositionAttribute = this.gl.getAttribLocation(this.shaderProgram, "aVertexPosition");
    this.gl.enableVertexAttribArray(aVertexPositionAttribute);
    vertexPositionAttributes.set(this.shaderProgram, aVertexPositionAttribute);
    const aVertexColorAttribute = this.gl.getAttribLocation(this.shaderProgram, "aVertexColor");
    this.gl.enableVertexAttribArray(aVertexColorAttribute);
    vertexColorAttributes.set(this.shaderProgram, aVertexColorAttribute);
    const aTextureCoordAttribute = this.gl.getAttribLocation(this.shaderProgram, "aTextureCoord");
    this.gl.enableVertexAttribArray(aTextureCoordAttribute);
    textureCoordAttributes.set(this.shaderProgram, aTextureCoordAttribute);
    const uMatrixLocation = this.gl.getUniformLocation(this.shaderProgram, "uPMatrix");
    uniformMatrixLocations.set(this.shaderProgram, uMatrixLocation);
    const uSamplerLocation = this.gl.getUniformLocation(this.shaderProgram, "uSampler");
    uniformSamplerLocations.set(this.shaderProgram, uSamplerLocation);
  }
  resizeCanvas() {
    this.canvasElement.width = this.canvasElement.offsetWidth * window.devicePixelRatio;
    this.canvasElement.height = this.canvasElement.offsetHeight * window.devicePixelRatio;
  }
  updateTransformAndConstraints() {
    const paddingFraction = 0.1;
    const dimensionsForAutoscale = this.dimensionsForAutoscale || { width: 0, height: 0 };
    const viewport = this.layerTree ? this.layerTree.viewportSize() : null;
    const baseWidth = viewport ? viewport.width : dimensionsForAutoscale.width;
    const baseHeight = viewport ? viewport.height : dimensionsForAutoscale.height;
    const canvasWidth = this.canvasElement.width;
    const canvasHeight = this.canvasElement.height;
    const paddingX = canvasWidth * paddingFraction;
    const paddingY = canvasHeight * paddingFraction;
    const scaleX = (canvasWidth - 2 * paddingX) / baseWidth;
    const scaleY = (canvasHeight - 2 * paddingY) / baseHeight;
    const viewScale = Math.min(scaleX, scaleY);
    const minScaleConstraint = Math.min(baseWidth / dimensionsForAutoscale.width, baseHeight / dimensionsForAutoscale.width) / 2;
    this.transformController.setScaleConstraints(minScaleConstraint, 10 / viewScale);
    const scale = this.transformController.scale();
    const rotateX = this.transformController.rotateX();
    const rotateY = this.transformController.rotateY();
    this.scale = scale * viewScale;
    const textureScale = Platform.NumberUtilities.clamp(this.scale, 0.1, 1);
    if (textureScale !== this.oldTextureScale) {
      this.oldTextureScale = textureScale;
      this.textureManager.setScale(textureScale);
      this.dispatchEventToListeners(Events.ScaleChanged, textureScale);
    }
    const scaleAndRotationMatrix = new WebKitCSSMatrix().scale(scale, scale, scale).translate(canvasWidth / 2, canvasHeight / 2, 0).rotate(rotateX, rotateY, 0).scale(viewScale, viewScale, viewScale).translate(-baseWidth / 2, -baseHeight / 2, 0);
    let bounds;
    for (let i = 0; i < this.rects.length; ++i) {
      bounds = UI.Geometry.boundsForTransformedPoints(scaleAndRotationMatrix, this.rects[i].vertices, bounds);
    }
    if (bounds) {
      this.transformController.clampOffsets((paddingX - bounds.maxX) / window.devicePixelRatio, (canvasWidth - paddingX - bounds.minX) / window.devicePixelRatio, (paddingY - bounds.maxY) / window.devicePixelRatio, (canvasHeight - paddingY - bounds.minY) / window.devicePixelRatio);
    }
    const offsetX = this.transformController.offsetX() * window.devicePixelRatio;
    const offsetY = this.transformController.offsetY() * window.devicePixelRatio;
    this.projectionMatrix = new WebKitCSSMatrix().translate(offsetX, offsetY, 0).multiply(scaleAndRotationMatrix);
    const glProjectionMatrix = new WebKitCSSMatrix().scale(1, -1, -1).translate(-1, -1, 0).scale(2 / this.canvasElement.width, 2 / this.canvasElement.height, 1 / 1e6).multiply(this.projectionMatrix);
    if (this.shaderProgram) {
      const pMatrixUniform = uniformMatrixLocations.get(this.shaderProgram);
      if (this.gl && pMatrixUniform) {
        this.gl.uniformMatrix4fv(pMatrixUniform, false, this.arrayFromMatrix(glProjectionMatrix));
      }
    }
  }
  arrayFromMatrix(m) {
    return new Float32Array([
      m.m11,
      m.m12,
      m.m13,
      m.m14,
      m.m21,
      m.m22,
      m.m23,
      m.m24,
      m.m31,
      m.m32,
      m.m33,
      m.m34,
      m.m41,
      m.m42,
      m.m43,
      m.m44
    ]);
  }
  initWhiteTexture() {
    if (!this.gl) {
      return;
    }
    this.whiteTexture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.whiteTexture);
    const whitePixel = new Uint8Array([255, 255, 255, 255]);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, whitePixel);
  }
  initChromeTextures() {
    function loadChromeTexture(index, url) {
      void UI.UIUtils.loadImage(url).then((image) => {
        this.chromeTextures[index] = image && LayerTextureManager.createTextureForImage(this.gl || null, image) || void 0;
      });
    }
    loadChromeTexture.call(this, ChromeTexture.Left, "Images/chromeLeft.avif");
    loadChromeTexture.call(this, ChromeTexture.Middle, "Images/chromeMiddle.avif");
    loadChromeTexture.call(this, ChromeTexture.Right, "Images/chromeRight.avif");
  }
  initGLIfNecessary() {
    if (this.gl) {
      return this.gl;
    }
    this.gl = this.initGL(this.canvasElement);
    if (!this.gl) {
      return null;
    }
    this.initShaders();
    this.initWhiteTexture();
    this.initChromeTextures();
    this.textureManager.setContext(this.gl);
    return this.gl;
  }
  calculateDepthsAndVisibility() {
    this.depthByLayerId = /* @__PURE__ */ new Map();
    let depth = 0;
    const showInternalLayers = this.layerViewHost.showInternalLayersSetting().get();
    if (!this.layerTree) {
      return;
    }
    const root = showInternalLayers ? this.layerTree.root() : this.layerTree.contentRoot() || this.layerTree.root();
    if (!root) {
      return;
    }
    const queue = [root];
    this.depthByLayerId.set(root.id(), 0);
    this.visibleLayers = /* @__PURE__ */ new Set();
    while (queue.length > 0) {
      const layer = queue.shift();
      if (!layer) {
        break;
      }
      if (showInternalLayers || layer.drawsContent()) {
        this.visibleLayers.add(layer);
      }
      const children = layer.children();
      for (let i = 0; i < children.length; ++i) {
        this.depthByLayerId.set(children[i].id(), ++depth);
        queue.push(children[i]);
      }
    }
    this.maxDepth = depth;
  }
  depthForLayer(layer) {
    return (this.depthByLayerId.get(layer.id()) || 0) * LayerSpacing;
  }
  calculateScrollRectDepth(layer, index) {
    return this.depthForLayer(layer) + index * ScrollRectSpacing + 1;
  }
  updateDimensionsForAutoscale(layer) {
    if (!this.dimensionsForAutoscale) {
      this.dimensionsForAutoscale = { width: 0, height: 0 };
    }
    this.dimensionsForAutoscale.width = Math.max(layer.width(), this.dimensionsForAutoscale.width);
    this.dimensionsForAutoscale.height = Math.max(layer.height(), this.dimensionsForAutoscale.height);
  }
  calculateLayerRect(layer) {
    if (!this.visibleLayers.has(layer)) {
      return;
    }
    const selection = new LayerSelection(layer);
    const rect = new Rectangle(selection);
    rect.setVertices(layer.quad(), this.depthForLayer(layer));
    this.appendRect(rect);
    this.updateDimensionsForAutoscale(layer);
  }
  appendRect(rect) {
    const selection = rect.relatedObject;
    const isSelected = Selection.isEqual(this.lastSelection[OutlineType.Selected], selection);
    const isHovered = Selection.isEqual(this.lastSelection[OutlineType.Hovered], selection);
    if (isSelected) {
      rect.borderColor = SelectedBorderColor;
    } else if (isHovered) {
      rect.borderColor = HoveredBorderColor;
      const fillColor = rect.fillColor || [255, 255, 255, 1];
      const maskColor = HoveredImageMaskColor;
      rect.fillColor = [
        fillColor[0] * maskColor[0] / 255,
        fillColor[1] * maskColor[1] / 255,
        fillColor[2] * maskColor[2] / 255,
        fillColor[3] * maskColor[3]
      ];
    } else {
      rect.borderColor = BorderColor;
    }
    rect.lineWidth = isSelected ? SelectedBorderWidth : BorderWidth;
    this.rects.push(rect);
  }
  calculateLayerScrollRects(layer) {
    const scrollRects = layer.scrollRects();
    for (let i = 0; i < scrollRects.length; ++i) {
      const selection = new ScrollRectSelection(layer, i);
      const rect = new Rectangle(selection);
      rect.calculateVerticesFromRect(layer, scrollRects[i].rect, this.calculateScrollRectDepth(layer, i));
      rect.fillColor = ScrollRectBackgroundColor;
      this.appendRect(rect);
    }
  }
  calculateLayerTileRects(layer) {
    const tiles = this.textureManager.tilesForLayer(layer);
    for (let i = 0; i < tiles.length; ++i) {
      const tile = tiles[i];
      if (!tile.texture) {
        continue;
      }
      const selection = new SnapshotSelection(layer, { rect: tile.rect, snapshot: tile.snapshot });
      const rect = new Rectangle(selection);
      if (!this.snapshotLayers.has(layer)) {
        this.snapshotLayers.set(layer, selection);
      }
      rect.calculateVerticesFromRect(layer, tile.rect, this.depthForLayer(layer) + 1);
      rect.texture = tile.texture;
      this.appendRect(rect);
    }
  }
  calculateRects() {
    this.rects = [];
    this.snapshotLayers.clear();
    this.dimensionsForAutoscale = { width: 0, height: 0 };
    if (this.layerTree) {
      this.layerTree.forEachLayer(this.calculateLayerRect.bind(this));
    }
    if (this.showSlowScrollRectsSetting && this.showSlowScrollRectsSetting.get() && this.layerTree) {
      this.layerTree.forEachLayer(this.calculateLayerScrollRects.bind(this));
    }
    if (this.layerTexture && this.visibleLayers.has(this.layerTexture.layer)) {
      const layer = this.layerTexture.layer;
      const selection = new LayerSelection(layer);
      const rect = new Rectangle(selection);
      rect.setVertices(layer.quad(), this.depthForLayer(layer));
      rect.texture = this.layerTexture.texture;
      this.appendRect(rect);
    } else if (this.showPaints() && this.layerTree) {
      this.layerTree.forEachLayer(this.calculateLayerTileRects.bind(this));
    }
  }
  makeColorsArray(color) {
    let colors = [];
    const normalizedColor = [color[0] / 255, color[1] / 255, color[2] / 255, color[3]];
    for (let i = 0; i < 4; i++) {
      colors = colors.concat(normalizedColor);
    }
    return colors;
  }
  setVertexAttribute(attribute, array, length) {
    const gl = this.gl;
    if (!gl) {
      return;
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(array), gl.STATIC_DRAW);
    gl.vertexAttribPointer(attribute, length, gl.FLOAT, false, 0, 0);
  }
  drawRectangle(vertices, mode, color, texture) {
    const gl = this.gl;
    const white = [255, 255, 255, 1];
    color = color || white;
    if (!this.shaderProgram) {
      return;
    }
    const vertexPositionAttribute = vertexPositionAttributes.get(this.shaderProgram);
    const textureCoordAttribute = textureCoordAttributes.get(this.shaderProgram);
    const vertexColorAttribute = vertexColorAttributes.get(this.shaderProgram);
    if (typeof vertexPositionAttribute !== "undefined") {
      this.setVertexAttribute(vertexPositionAttribute, vertices, 3);
    }
    if (typeof textureCoordAttribute !== "undefined") {
      this.setVertexAttribute(textureCoordAttribute, [0, 1, 1, 1, 1, 0, 0, 0], 2);
    }
    if (typeof vertexColorAttribute !== "undefined") {
      this.setVertexAttribute(vertexColorAttribute, this.makeColorsArray(color), color.length);
    }
    if (!gl) {
      return;
    }
    const samplerUniform = uniformSamplerLocations.get(this.shaderProgram);
    if (texture) {
      if (samplerUniform) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(samplerUniform, 0);
      }
    } else if (this.whiteTexture) {
      gl.bindTexture(gl.TEXTURE_2D, this.whiteTexture);
    }
    const numberOfVertices = vertices.length / 3;
    gl.drawArrays(mode, 0, numberOfVertices);
  }
  drawTexture(vertices, texture, color) {
    if (!this.gl) {
      return;
    }
    this.drawRectangle(vertices, this.gl.TRIANGLE_FAN, color, texture);
  }
  drawViewportAndChrome() {
    if (!this.layerTree) {
      return;
    }
    const viewport = this.layerTree.viewportSize();
    if (!viewport) {
      return;
    }
    const drawChrome = !Common.Settings.Settings.instance().moduleSetting("frameViewerHideChromeWindow").get() && this.chromeTextures.length >= 3 && this.chromeTextures.indexOf(void 0) < 0;
    const z = (this.maxDepth + 1) * LayerSpacing;
    const borderWidth = Math.ceil(ViewportBorderWidth * this.scale);
    let vertices = [viewport.width, 0, z, viewport.width, viewport.height, z, 0, viewport.height, z, 0, 0, z];
    if (!this.gl) {
      return;
    }
    this.gl.lineWidth(borderWidth);
    this.drawRectangle(vertices, drawChrome ? this.gl.LINE_STRIP : this.gl.LINE_LOOP, ViewportBorderColor);
    if (!drawChrome) {
      return;
    }
    const viewportSize = this.layerTree.viewportSize();
    if (!viewportSize) {
      return;
    }
    const borderAdjustment = ViewportBorderWidth / 2;
    const viewportWidth = viewportSize.width + 2 * borderAdjustment;
    if (this.chromeTextures[0] && this.chromeTextures[2]) {
      const chromeTextureImage = imageForTexture.get(this.chromeTextures[0]) || { naturalHeight: 0, naturalWidth: 0 };
      const chromeHeight = chromeTextureImage.naturalHeight;
      const middleTextureImage = imageForTexture.get(this.chromeTextures[2]) || { naturalHeight: 0, naturalWidth: 0 };
      const middleFragmentWidth = viewportWidth - chromeTextureImage.naturalWidth - middleTextureImage.naturalWidth;
      let x = -borderAdjustment;
      const y = -chromeHeight;
      for (let i = 0; i < this.chromeTextures.length; ++i) {
        const texture = this.chromeTextures[i];
        if (!texture) {
          continue;
        }
        const image = imageForTexture.get(texture);
        if (!image) {
          continue;
        }
        const width = i === ChromeTexture.Middle ? middleFragmentWidth : image.naturalWidth;
        if (width < 0 || x + width > viewportWidth) {
          break;
        }
        vertices = [x, y, z, x + width, y, z, x + width, y + chromeHeight, z, x, y + chromeHeight, z];
        this.drawTexture(vertices, this.chromeTextures[i]);
        x += width;
      }
    }
  }
  drawViewRect(rect) {
    if (!this.gl) {
      return;
    }
    const vertices = rect.vertices;
    if (rect.texture) {
      this.drawTexture(vertices, rect.texture, rect.fillColor || void 0);
    } else if (rect.fillColor) {
      this.drawRectangle(vertices, this.gl.TRIANGLE_FAN, rect.fillColor);
    }
    this.gl.lineWidth(rect.lineWidth);
    if (rect.borderColor) {
      this.drawRectangle(vertices, this.gl.LINE_LOOP, rect.borderColor);
    }
  }
  update() {
    if (!this.isShowing()) {
      this.needsUpdate = true;
      return;
    }
    if (!this.layerTree || !this.layerTree.root()) {
      this.failBanner.show(this.contentElement);
      return;
    }
    const gl = this.initGLIfNecessary();
    if (!gl) {
      this.failBanner.element.removeChildren();
      this.failBanner.element.appendChild(this.webglDisabledBanner());
      this.failBanner.show(this.contentElement);
      return;
    }
    this.failBanner.detach();
    const viewportWidth = this.canvasElement.width;
    const viewportHeight = this.canvasElement.height;
    this.calculateDepthsAndVisibility();
    this.calculateRects();
    this.updateTransformAndConstraints();
    gl.viewport(0, 0, viewportWidth, viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.rects.forEach(this.drawViewRect.bind(this));
    this.drawViewportAndChrome();
  }
  webglDisabledBanner() {
    const fragment = this.contentElement.ownerDocument.createDocumentFragment();
    fragment.createChild("div").textContent = i18nString(UIStrings.cantDisplayLayers);
    fragment.createChild("div").textContent = i18nString(UIStrings.webglSupportIsDisabledInYour);
    fragment.appendChild(i18n.i18n.getFormatLocalizedString(str_, UIStrings.checkSForPossibleReasons, { PH1: UI.XLink.XLink.create("about:gpu") }));
    return fragment;
  }
  selectionFromEventPoint(event) {
    const mouseEvent = event;
    if (!this.layerTree) {
      return null;
    }
    let closestIntersectionPoint = Infinity;
    let closestObject = null;
    const projectionMatrix = new WebKitCSSMatrix().scale(1, -1, -1).translate(-1, -1, 0).multiply(this.projectionMatrix);
    const x0 = (mouseEvent.clientX - this.canvasElement.totalOffsetLeft()) * window.devicePixelRatio;
    const y0 = -(mouseEvent.clientY - this.canvasElement.totalOffsetTop()) * window.devicePixelRatio;
    function checkIntersection(rect) {
      if (!rect.relatedObject) {
        return;
      }
      const t = rect.intersectWithLine(projectionMatrix, x0, y0);
      if (t && t < closestIntersectionPoint) {
        closestIntersectionPoint = t;
        closestObject = rect.relatedObject;
      }
    }
    this.rects.forEach(checkIntersection);
    return closestObject;
  }
  createVisibilitySetting(caption, name, value, toolbar) {
    const setting = Common.Settings.Settings.instance().createSetting(name, value);
    setting.setTitle(caption);
    setting.addChangeListener(this.update, this);
    toolbar.appendToolbarItem(new UI.Toolbar.ToolbarSettingCheckbox(setting));
    return setting;
  }
  initToolbar() {
    this.panelToolbar = this.transformController.toolbar();
    this.contentElement.appendChild(this.panelToolbar.element);
    this.showSlowScrollRectsSetting = this.createVisibilitySetting(i18nString(UIStrings.slowScrollRects), "frameViewerShowSlowScrollRects", true, this.panelToolbar);
    this.showPaintsSetting = this.createVisibilitySetting(i18nString(UIStrings.paints), "frameViewerShowPaints", true, this.panelToolbar);
    this.showPaintsSetting.addChangeListener(this.updatePaints, this);
    Common.Settings.Settings.instance().moduleSetting("frameViewerHideChromeWindow").addChangeListener(this.update, this);
  }
  onContextMenu(event) {
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    contextMenu.defaultSection().appendItem(i18nString(UIStrings.resetView), () => this.transformController.resetAndNotify(), false);
    const selection = this.selectionFromEventPoint(event);
    if (selection && selection.type() === Type.Snapshot) {
      contextMenu.defaultSection().appendItem(i18nString(UIStrings.showPaintProfiler), () => this.dispatchEventToListeners(Events.PaintProfilerRequested, selection), false);
    }
    this.layerViewHost.showContextMenu(contextMenu, selection);
  }
  onMouseMove(event) {
    const mouseEvent = event;
    if (mouseEvent.which) {
      return;
    }
    this.layerViewHost.hoverObject(this.selectionFromEventPoint(event));
  }
  onMouseDown(event) {
    const mouseEvent = event;
    this.mouseDownX = mouseEvent.clientX;
    this.mouseDownY = mouseEvent.clientY;
  }
  onMouseUp(event) {
    const mouseEvent = event;
    const maxDistanceInPixels = 6;
    if (this.mouseDownX && Math.abs(mouseEvent.clientX - this.mouseDownX) < maxDistanceInPixels && Math.abs(mouseEvent.clientY - (this.mouseDownY || 0)) < maxDistanceInPixels) {
      this.canvasElement.focus();
      this.layerViewHost.selectObject(this.selectionFromEventPoint(event));
    }
    delete this.mouseDownX;
    delete this.mouseDownY;
  }
  onDoubleClick(event) {
    const selection = this.selectionFromEventPoint(event);
    if (selection && (selection.type() === Type.Snapshot || selection.layer())) {
      this.dispatchEventToListeners(Events.PaintProfilerRequested, selection);
    }
    event.stopPropagation();
  }
  updatePaints() {
    if (this.showPaints()) {
      this.textureManager.setLayerTree(this.layerTree);
      this.textureManager.forceUpdate();
    } else {
      this.textureManager.reset();
    }
    this.update();
  }
  showPaints() {
    return this.showPaintsSetting ? this.showPaintsSetting.get() : false;
  }
}
export var OutlineType = /* @__PURE__ */ ((OutlineType2) => {
  OutlineType2["Hovered"] = "hovered";
  OutlineType2["Selected"] = "selected";
  return OutlineType2;
})(OutlineType || {});
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["PaintProfilerRequested"] = "PaintProfilerRequested";
  Events2["ScaleChanged"] = "ScaleChanged";
  return Events2;
})(Events || {});
export var ChromeTexture = /* @__PURE__ */ ((ChromeTexture2) => {
  ChromeTexture2[ChromeTexture2["Left"] = 0] = "Left";
  ChromeTexture2[ChromeTexture2["Middle"] = 1] = "Middle";
  ChromeTexture2[ChromeTexture2["Right"] = 2] = "Right";
  return ChromeTexture2;
})(ChromeTexture || {});
export const FragmentShader = "precision mediump float;\nvarying vec4 vColor;\nvarying vec2 vTextureCoord;\nuniform sampler2D uSampler;\nvoid main(void)\n{\n    gl_FragColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t)) * vColor;\n}";
export const VertexShader = "attribute vec3 aVertexPosition;\nattribute vec2 aTextureCoord;\nattribute vec4 aVertexColor;\nuniform mat4 uPMatrix;\nvarying vec2 vTextureCoord;\nvarying vec4 vColor;\nvoid main(void)\n{\ngl_Position = uPMatrix * vec4(aVertexPosition, 1.0);\nvColor = aVertexColor;\nvTextureCoord = aTextureCoord;\n}";
export const HoveredBorderColor = [0, 0, 255, 1];
export const SelectedBorderColor = [0, 255, 0, 1];
export const BorderColor = [0, 0, 0, 1];
export const ViewportBorderColor = [160, 160, 160, 1];
export const ScrollRectBackgroundColor = [178, 100, 100, 0.6];
export const HoveredImageMaskColor = [200, 200, 255, 1];
export const BorderWidth = 1;
export const SelectedBorderWidth = 2;
export const ViewportBorderWidth = 3;
export const LayerSpacing = 20;
export const ScrollRectSpacing = 4;
export class LayerTextureManager {
  textureUpdatedCallback;
  throttler;
  scale;
  active;
  queue;
  tilesByLayer;
  gl;
  constructor(textureUpdatedCallback) {
    this.textureUpdatedCallback = textureUpdatedCallback;
    this.throttler = new Common.Throttler.Throttler(0);
    this.scale = 0;
    this.active = false;
    this.reset();
  }
  static createTextureForImage(gl, image) {
    if (!gl) {
      throw new Error("WebGLRenderingContext not provided");
    }
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("Unable to create texture");
    }
    imageForTexture.set(texture, image);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }
  reset() {
    if (this.tilesByLayer) {
      this.setLayerTree(null);
    }
    this.tilesByLayer = /* @__PURE__ */ new Map();
    this.queue = [];
  }
  setContext(glContext) {
    this.gl = glContext;
    if (this.scale) {
      this.updateTextures();
    }
  }
  suspend() {
    this.active = false;
  }
  resume() {
    this.active = true;
    if (this.queue.length) {
      void this.update();
    }
  }
  setLayerTree(layerTree) {
    const newLayers = /* @__PURE__ */ new Set();
    const oldLayers = Array.from(this.tilesByLayer.keys());
    if (layerTree) {
      layerTree.forEachLayer((layer) => {
        if (!layer.drawsContent()) {
          return;
        }
        newLayers.add(layer);
        if (!this.tilesByLayer.has(layer)) {
          this.tilesByLayer.set(layer, []);
          this.layerNeedsUpdate(layer);
        }
      });
    }
    if (!oldLayers.length) {
      this.forceUpdate();
    }
    for (const layer of oldLayers) {
      if (newLayers.has(layer)) {
        continue;
      }
      const tiles = this.tilesByLayer.get(layer);
      if (tiles) {
        tiles.forEach((tile) => tile.dispose());
      }
      this.tilesByLayer.delete(layer);
    }
  }
  setSnapshotsForLayer(layer, snapshots) {
    const oldSnapshotsToTiles = new Map((this.tilesByLayer.get(layer) || []).map((tile) => [tile.snapshot, tile]));
    const newTiles = [];
    const reusedTiles = [];
    for (const snapshot of snapshots) {
      const oldTile = oldSnapshotsToTiles.get(snapshot.snapshot);
      if (oldTile) {
        reusedTiles.push(oldTile);
        oldSnapshotsToTiles.delete(snapshot.snapshot);
      } else {
        newTiles.push(new Tile(snapshot));
      }
    }
    this.tilesByLayer.set(layer, reusedTiles.concat(newTiles));
    for (const tile of oldSnapshotsToTiles.values()) {
      tile.dispose();
    }
    const gl = this.gl;
    if (!gl || !this.scale) {
      return Promise.resolve();
    }
    return Promise.all(newTiles.map((tile) => tile.update(gl, this.scale))).then(this.textureUpdatedCallback);
  }
  setScale(scale) {
    if (this.scale && this.scale >= scale) {
      return;
    }
    this.scale = scale;
    this.updateTextures();
  }
  tilesForLayer(layer) {
    return this.tilesByLayer.get(layer) || [];
  }
  layerNeedsUpdate(layer) {
    if (this.queue.indexOf(layer) < 0) {
      this.queue.push(layer);
    }
    if (this.active) {
      void this.throttler.schedule(this.update.bind(this));
    }
  }
  forceUpdate() {
    this.queue.forEach((layer) => this.updateLayer(layer));
    this.queue = [];
    void this.update();
  }
  update() {
    const layer = this.queue.shift();
    if (!layer) {
      return Promise.resolve();
    }
    if (this.queue.length) {
      void this.throttler.schedule(this.update.bind(this));
    }
    return this.updateLayer(layer);
  }
  updateLayer(layer) {
    return Promise.all(layer.snapshots()).then((snapshots) => this.setSnapshotsForLayer(layer, snapshots.filter((snapshot) => snapshot !== null)));
  }
  updateTextures() {
    if (!this.gl) {
      return;
    }
    if (!this.scale) {
      return;
    }
    for (const tiles of this.tilesByLayer.values()) {
      for (const tile of tiles) {
        const promise = tile.updateScale(this.gl, this.scale);
        if (promise) {
          void promise.then(this.textureUpdatedCallback);
        }
      }
    }
  }
}
export class Rectangle {
  relatedObject;
  lineWidth;
  borderColor;
  fillColor;
  texture;
  vertices;
  constructor(relatedObject) {
    this.relatedObject = relatedObject;
    this.lineWidth = 1;
    this.borderColor = null;
    this.fillColor = null;
    this.texture = null;
  }
  setVertices(quad, z) {
    this.vertices = [quad[0], quad[1], z, quad[2], quad[3], z, quad[4], quad[5], z, quad[6], quad[7], z];
  }
  calculatePointOnQuad(quad, ratioX, ratioY) {
    const x0 = quad[0];
    const y0 = quad[1];
    const x1 = quad[2];
    const y1 = quad[3];
    const x2 = quad[4];
    const y2 = quad[5];
    const x3 = quad[6];
    const y3 = quad[7];
    const firstSidePointX = x0 + ratioX * (x1 - x0);
    const firstSidePointY = y0 + ratioX * (y1 - y0);
    const thirdSidePointX = x3 + ratioX * (x2 - x3);
    const thirdSidePointY = y3 + ratioX * (y2 - y3);
    const x = firstSidePointX + ratioY * (thirdSidePointX - firstSidePointX);
    const y = firstSidePointY + ratioY * (thirdSidePointY - firstSidePointY);
    return [x, y];
  }
  calculateVerticesFromRect(layer, rect, z) {
    const quad = layer.quad();
    const rx1 = rect.x / layer.width();
    const rx2 = (rect.x + rect.width) / layer.width();
    const ry1 = rect.y / layer.height();
    const ry2 = (rect.y + rect.height) / layer.height();
    const rectQuad = this.calculatePointOnQuad(quad, rx1, ry1).concat(this.calculatePointOnQuad(quad, rx2, ry1)).concat(this.calculatePointOnQuad(quad, rx2, ry2)).concat(this.calculatePointOnQuad(quad, rx1, ry2));
    this.setVertices(rectQuad, z);
  }
  intersectWithLine(matrix, x0, y0) {
    let i;
    const points = [];
    for (i = 0; i < 4; ++i) {
      points[i] = UI.Geometry.multiplyVectorByMatrixAndNormalize(new UI.Geometry.Vector(this.vertices[i * 3], this.vertices[i * 3 + 1], this.vertices[i * 3 + 2]), matrix);
    }
    const normal = UI.Geometry.crossProduct(UI.Geometry.subtract(points[1], points[0]), UI.Geometry.subtract(points[2], points[1]));
    const A = normal.x;
    const B = normal.y;
    const C = normal.z;
    const D = -(A * points[0].x + B * points[0].y + C * points[0].z);
    const t = -(D + A * x0 + B * y0) / C;
    const pt = new UI.Geometry.Vector(x0, y0, t);
    const tVects = points.map(UI.Geometry.subtract.bind(null, pt));
    for (i = 0; i < tVects.length; ++i) {
      const product = UI.Geometry.scalarProduct(normal, UI.Geometry.crossProduct(tVects[i], tVects[(i + 1) % tVects.length]));
      if (product < 0) {
        return void 0;
      }
    }
    return t;
  }
}
export class Tile {
  snapshot;
  rect;
  scale;
  texture;
  gl;
  constructor(snapshotWithRect) {
    this.snapshot = snapshotWithRect.snapshot;
    this.rect = snapshotWithRect.rect;
    this.scale = 0;
    this.texture = null;
  }
  dispose() {
    this.snapshot.release();
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
  }
  updateScale(glContext, scale) {
    if (this.texture && this.scale >= scale) {
      return null;
    }
    return this.update(glContext, scale);
  }
  async update(glContext, scale) {
    this.gl = glContext;
    this.scale = scale;
    const imageURL = await this.snapshot.replay(scale);
    const image = imageURL ? await UI.UIUtils.loadImage(imageURL) : null;
    this.texture = image ? LayerTextureManager.createTextureForImage(glContext, image) : null;
  }
}
//# sourceMappingURL=Layers3DView.js.map
