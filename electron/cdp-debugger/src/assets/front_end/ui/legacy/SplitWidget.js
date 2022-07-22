import * as Common from "../../core/common/common.js";
import * as Platform from "../../core/platform/platform.js";
import * as ARIAUtils from "./ARIAUtils.js";
import { Constraints } from "./Geometry.js";
import { Events as ResizerWidgetEvents, SimpleResizerWidget } from "./ResizerWidget.js";
import { ToolbarButton } from "./Toolbar.js";
import { Widget } from "./Widget.js";
import { Events as ZoomManagerEvents, ZoomManager } from "./ZoomManager.js";
import splitWidgetStyles from "./splitWidget.css.legacy.js";
export class SplitWidget extends Common.ObjectWrapper.eventMixin(Widget) {
  sidebarElementInternal;
  mainElement;
  resizerElementInternal;
  resizerElementSize;
  resizerWidget;
  defaultSidebarWidth;
  defaultSidebarHeight;
  constraintsInDip;
  resizeStartSizeDIP;
  setting;
  totalSizeCSS;
  totalSizeOtherDimensionCSS;
  mainWidgetInternal;
  sidebarWidgetInternal;
  animationFrameHandle;
  animationCallback;
  showSidebarButtonTitle;
  hideSidebarButtonTitle;
  shownSidebarString;
  hiddenSidebarString;
  showHideSidebarButton;
  isVerticalInternal;
  sidebarMinimized;
  detaching;
  sidebarSizeDIP;
  savedSidebarSizeDIP;
  secondIsSidebar;
  shouldSaveShowMode;
  savedVerticalMainSize;
  savedHorizontalMainSize;
  showModeInternal;
  savedShowMode;
  constructor(isVertical, secondIsSidebar, settingName, defaultSidebarWidth, defaultSidebarHeight, constraintsInDip) {
    super(true);
    this.element.classList.add("split-widget");
    this.registerRequiredCSS(splitWidgetStyles);
    this.contentElement.classList.add("shadow-split-widget");
    this.sidebarElementInternal = this.contentElement.createChild("div", "shadow-split-widget-contents shadow-split-widget-sidebar vbox");
    this.mainElement = this.contentElement.createChild("div", "shadow-split-widget-contents shadow-split-widget-main vbox");
    this.mainElement.createChild("slot").name = "insertion-point-main";
    this.sidebarElementInternal.createChild("slot").name = "insertion-point-sidebar";
    this.resizerElementInternal = this.contentElement.createChild("div", "shadow-split-widget-resizer");
    this.resizerElementSize = null;
    this.resizerWidget = new SimpleResizerWidget();
    this.resizerWidget.setEnabled(true);
    this.resizerWidget.addEventListener(ResizerWidgetEvents.ResizeStart, this.onResizeStart, this);
    this.resizerWidget.addEventListener(ResizerWidgetEvents.ResizeUpdatePosition, this.onResizeUpdate, this);
    this.resizerWidget.addEventListener(ResizerWidgetEvents.ResizeEnd, this.onResizeEnd, this);
    this.defaultSidebarWidth = defaultSidebarWidth || 200;
    this.defaultSidebarHeight = defaultSidebarHeight || this.defaultSidebarWidth;
    this.constraintsInDip = Boolean(constraintsInDip);
    this.resizeStartSizeDIP = 0;
    this.setting = settingName ? Common.Settings.Settings.instance().createSetting(settingName, {}) : null;
    this.totalSizeCSS = 0;
    this.totalSizeOtherDimensionCSS = 0;
    this.mainWidgetInternal = null;
    this.sidebarWidgetInternal = null;
    this.animationFrameHandle = 0;
    this.animationCallback = null;
    this.showSidebarButtonTitle = Common.UIString.LocalizedEmptyString;
    this.hideSidebarButtonTitle = Common.UIString.LocalizedEmptyString;
    this.shownSidebarString = Common.UIString.LocalizedEmptyString;
    this.hiddenSidebarString = Common.UIString.LocalizedEmptyString;
    this.showHideSidebarButton = null;
    this.isVerticalInternal = false;
    this.sidebarMinimized = false;
    this.detaching = false;
    this.sidebarSizeDIP = -1;
    this.savedSidebarSizeDIP = this.sidebarSizeDIP;
    this.secondIsSidebar = false;
    this.shouldSaveShowMode = false;
    this.savedVerticalMainSize = null;
    this.savedHorizontalMainSize = null;
    this.setSecondIsSidebar(secondIsSidebar);
    this.innerSetVertical(isVertical);
    this.showModeInternal = ShowMode.Both;
    this.savedShowMode = this.showModeInternal;
    this.installResizer(this.resizerElementInternal);
  }
  isVertical() {
    return this.isVerticalInternal;
  }
  setVertical(isVertical) {
    if (this.isVerticalInternal === isVertical) {
      return;
    }
    this.innerSetVertical(isVertical);
    if (this.isShowing()) {
      this.updateLayout();
    }
  }
  innerSetVertical(isVertical) {
    this.contentElement.classList.toggle("vbox", !isVertical);
    this.contentElement.classList.toggle("hbox", isVertical);
    this.isVerticalInternal = isVertical;
    this.resizerElementSize = null;
    this.sidebarSizeDIP = -1;
    this.restoreSidebarSizeFromSettings();
    if (this.shouldSaveShowMode) {
      this.restoreAndApplyShowModeFromSettings();
    }
    this.updateShowHideSidebarButton();
    this.resizerWidget.setVertical(!isVertical);
    this.invalidateConstraints();
  }
  updateLayout(animate) {
    this.totalSizeCSS = 0;
    this.totalSizeOtherDimensionCSS = 0;
    this.mainElement.style.removeProperty("width");
    this.mainElement.style.removeProperty("height");
    this.sidebarElementInternal.style.removeProperty("width");
    this.sidebarElementInternal.style.removeProperty("height");
    this.innerSetSidebarSizeDIP(this.preferredSidebarSizeDIP(), Boolean(animate));
  }
  setMainWidget(widget) {
    if (this.mainWidgetInternal === widget) {
      return;
    }
    this.suspendInvalidations();
    if (this.mainWidgetInternal) {
      this.mainWidgetInternal.detach();
    }
    this.mainWidgetInternal = widget;
    if (widget) {
      widget.element.slot = "insertion-point-main";
      if (this.showModeInternal === ShowMode.OnlyMain || this.showModeInternal === ShowMode.Both) {
        widget.show(this.element);
      }
    }
    this.resumeInvalidations();
  }
  setSidebarWidget(widget) {
    if (this.sidebarWidgetInternal === widget) {
      return;
    }
    this.suspendInvalidations();
    if (this.sidebarWidgetInternal) {
      this.sidebarWidgetInternal.detach();
    }
    this.sidebarWidgetInternal = widget;
    if (widget) {
      widget.element.slot = "insertion-point-sidebar";
      if (this.showModeInternal === ShowMode.OnlySidebar || this.showModeInternal === ShowMode.Both) {
        widget.show(this.element);
      }
    }
    this.resumeInvalidations();
  }
  mainWidget() {
    return this.mainWidgetInternal;
  }
  sidebarWidget() {
    return this.sidebarWidgetInternal;
  }
  sidebarElement() {
    return this.sidebarElementInternal;
  }
  childWasDetached(widget) {
    if (this.detaching) {
      return;
    }
    if (this.mainWidgetInternal === widget) {
      this.mainWidgetInternal = null;
    }
    if (this.sidebarWidgetInternal === widget) {
      this.sidebarWidgetInternal = null;
    }
    this.invalidateConstraints();
  }
  isSidebarSecond() {
    return this.secondIsSidebar;
  }
  enableShowModeSaving() {
    this.shouldSaveShowMode = true;
    this.restoreAndApplyShowModeFromSettings();
  }
  showMode() {
    return this.showModeInternal;
  }
  setSecondIsSidebar(secondIsSidebar) {
    if (secondIsSidebar === this.secondIsSidebar) {
      return;
    }
    this.secondIsSidebar = secondIsSidebar;
    if (!this.mainWidgetInternal || !this.mainWidgetInternal.shouldHideOnDetach()) {
      if (secondIsSidebar) {
        this.contentElement.insertBefore(this.mainElement, this.sidebarElementInternal);
      } else {
        this.contentElement.insertBefore(this.mainElement, this.resizerElementInternal);
      }
    } else if (!this.sidebarWidgetInternal || !this.sidebarWidgetInternal.shouldHideOnDetach()) {
      if (secondIsSidebar) {
        this.contentElement.insertBefore(this.sidebarElementInternal, this.resizerElementInternal);
      } else {
        this.contentElement.insertBefore(this.sidebarElementInternal, this.mainElement);
      }
    } else {
      console.error("Could not swap split widget side. Both children widgets contain iframes.");
      this.secondIsSidebar = !secondIsSidebar;
    }
  }
  sidebarSide() {
    if (this.showModeInternal !== ShowMode.Both) {
      return null;
    }
    return this.isVerticalInternal ? this.secondIsSidebar ? "right" : "left" : this.secondIsSidebar ? "bottom" : "top";
  }
  resizerElement() {
    return this.resizerElementInternal;
  }
  hideMain(animate) {
    this.showOnly(this.sidebarWidgetInternal, this.mainWidgetInternal, this.sidebarElementInternal, this.mainElement, animate);
    this.updateShowMode(ShowMode.OnlySidebar);
  }
  hideSidebar(animate) {
    this.showOnly(this.mainWidgetInternal, this.sidebarWidgetInternal, this.mainElement, this.sidebarElementInternal, animate);
    this.updateShowMode(ShowMode.OnlyMain);
  }
  setSidebarMinimized(minimized) {
    this.sidebarMinimized = minimized;
    this.invalidateConstraints();
  }
  isSidebarMinimized() {
    return this.sidebarMinimized;
  }
  showOnly(sideToShow, sideToHide, shadowToShow, shadowToHide, animate) {
    this.cancelAnimation();
    function callback() {
      if (sideToShow) {
        if (sideToShow === this.mainWidgetInternal) {
          this.mainWidgetInternal.show(this.element, this.sidebarWidgetInternal ? this.sidebarWidgetInternal.element : null);
        } else if (this.sidebarWidgetInternal) {
          this.sidebarWidgetInternal.show(this.element);
        }
      }
      if (sideToHide) {
        this.detaching = true;
        sideToHide.detach();
        this.detaching = false;
      }
      this.resizerElementInternal.classList.add("hidden");
      shadowToShow.classList.remove("hidden");
      shadowToShow.classList.add("maximized");
      shadowToHide.classList.add("hidden");
      shadowToHide.classList.remove("maximized");
      this.removeAllLayoutProperties();
      this.doResize();
      this.showFinishedForTest();
    }
    if (animate) {
      this.animate(true, callback.bind(this));
    } else {
      callback.call(this);
    }
    this.sidebarSizeDIP = -1;
    this.setResizable(false);
  }
  showFinishedForTest() {
  }
  removeAllLayoutProperties() {
    this.sidebarElementInternal.style.removeProperty("flexBasis");
    this.mainElement.style.removeProperty("width");
    this.mainElement.style.removeProperty("height");
    this.sidebarElementInternal.style.removeProperty("width");
    this.sidebarElementInternal.style.removeProperty("height");
    this.resizerElementInternal.style.removeProperty("left");
    this.resizerElementInternal.style.removeProperty("right");
    this.resizerElementInternal.style.removeProperty("top");
    this.resizerElementInternal.style.removeProperty("bottom");
    this.resizerElementInternal.style.removeProperty("margin-left");
    this.resizerElementInternal.style.removeProperty("margin-right");
    this.resizerElementInternal.style.removeProperty("margin-top");
    this.resizerElementInternal.style.removeProperty("margin-bottom");
  }
  showBoth(animate) {
    if (this.showModeInternal === ShowMode.Both) {
      animate = false;
    }
    this.cancelAnimation();
    this.mainElement.classList.remove("maximized", "hidden");
    this.sidebarElementInternal.classList.remove("maximized", "hidden");
    this.resizerElementInternal.classList.remove("hidden");
    this.setResizable(true);
    this.suspendInvalidations();
    if (this.sidebarWidgetInternal) {
      this.sidebarWidgetInternal.show(this.element);
    }
    if (this.mainWidgetInternal) {
      this.mainWidgetInternal.show(this.element, this.sidebarWidgetInternal ? this.sidebarWidgetInternal.element : null);
    }
    this.resumeInvalidations();
    this.setSecondIsSidebar(this.secondIsSidebar);
    this.sidebarSizeDIP = -1;
    this.updateShowMode(ShowMode.Both);
    this.updateLayout(animate);
  }
  setResizable(resizable) {
    this.resizerWidget.setEnabled(resizable);
  }
  isResizable() {
    return this.resizerWidget.isEnabled();
  }
  setSidebarSize(size) {
    const sizeDIP = ZoomManager.instance().cssToDIP(size);
    this.savedSidebarSizeDIP = sizeDIP;
    this.saveSetting();
    this.innerSetSidebarSizeDIP(sizeDIP, false, true);
  }
  sidebarSize() {
    const sizeDIP = Math.max(0, this.sidebarSizeDIP);
    return ZoomManager.instance().dipToCSS(sizeDIP);
  }
  totalSizeDIP() {
    if (!this.totalSizeCSS) {
      this.totalSizeCSS = this.isVerticalInternal ? this.contentElement.offsetWidth : this.contentElement.offsetHeight;
      this.totalSizeOtherDimensionCSS = this.isVerticalInternal ? this.contentElement.offsetHeight : this.contentElement.offsetWidth;
    }
    return ZoomManager.instance().cssToDIP(this.totalSizeCSS);
  }
  updateShowMode(showMode) {
    this.showModeInternal = showMode;
    this.saveShowModeToSettings();
    this.updateShowHideSidebarButton();
    this.dispatchEventToListeners(Events.ShowModeChanged, showMode);
    this.invalidateConstraints();
  }
  innerSetSidebarSizeDIP(sizeDIP, animate, userAction) {
    if (this.showModeInternal !== ShowMode.Both || !this.isShowing()) {
      return;
    }
    sizeDIP = this.applyConstraints(sizeDIP, userAction);
    if (this.sidebarSizeDIP === sizeDIP) {
      return;
    }
    if (!this.resizerElementSize) {
      this.resizerElementSize = this.isVerticalInternal ? this.resizerElementInternal.offsetWidth : this.resizerElementInternal.offsetHeight;
    }
    this.removeAllLayoutProperties();
    const roundSizeCSS = Math.round(ZoomManager.instance().dipToCSS(sizeDIP));
    const sidebarSizeValue = roundSizeCSS + "px";
    const mainSizeValue = this.totalSizeCSS - roundSizeCSS + "px";
    this.sidebarElementInternal.style.flexBasis = sidebarSizeValue;
    if (this.isVerticalInternal) {
      this.sidebarElementInternal.style.width = sidebarSizeValue;
      this.mainElement.style.width = mainSizeValue;
      this.sidebarElementInternal.style.height = this.totalSizeOtherDimensionCSS + "px";
      this.mainElement.style.height = this.totalSizeOtherDimensionCSS + "px";
    } else {
      this.sidebarElementInternal.style.height = sidebarSizeValue;
      this.mainElement.style.height = mainSizeValue;
      this.sidebarElementInternal.style.width = this.totalSizeOtherDimensionCSS + "px";
      this.mainElement.style.width = this.totalSizeOtherDimensionCSS + "px";
    }
    if (this.isVerticalInternal) {
      if (this.secondIsSidebar) {
        this.resizerElementInternal.style.right = sidebarSizeValue;
        this.resizerElementInternal.style.marginRight = -this.resizerElementSize / 2 + "px";
      } else {
        this.resizerElementInternal.style.left = sidebarSizeValue;
        this.resizerElementInternal.style.marginLeft = -this.resizerElementSize / 2 + "px";
      }
    } else {
      if (this.secondIsSidebar) {
        this.resizerElementInternal.style.bottom = sidebarSizeValue;
        this.resizerElementInternal.style.marginBottom = -this.resizerElementSize / 2 + "px";
      } else {
        this.resizerElementInternal.style.top = sidebarSizeValue;
        this.resizerElementInternal.style.marginTop = -this.resizerElementSize / 2 + "px";
      }
    }
    this.sidebarSizeDIP = sizeDIP;
    if (animate) {
      this.animate(false);
    } else {
      this.doResize();
      this.dispatchEventToListeners(Events.SidebarSizeChanged, this.sidebarSize());
    }
  }
  animate(reverse, callback) {
    const animationTime = 50;
    this.animationCallback = callback || null;
    let animatedMarginPropertyName;
    if (this.isVerticalInternal) {
      animatedMarginPropertyName = this.secondIsSidebar ? "margin-right" : "margin-left";
    } else {
      animatedMarginPropertyName = this.secondIsSidebar ? "margin-bottom" : "margin-top";
    }
    const marginFrom = reverse ? "0" : "-" + ZoomManager.instance().dipToCSS(this.sidebarSizeDIP) + "px";
    const marginTo = reverse ? "-" + ZoomManager.instance().dipToCSS(this.sidebarSizeDIP) + "px" : "0";
    this.contentElement.style.setProperty(animatedMarginPropertyName, marginFrom);
    if (!reverse) {
      suppressUnused(this.mainElement.offsetWidth);
      suppressUnused(this.sidebarElementInternal.offsetWidth);
    }
    if (!reverse && this.sidebarWidgetInternal) {
      this.sidebarWidgetInternal.doResize();
    }
    this.contentElement.style.setProperty("transition", animatedMarginPropertyName + " " + animationTime + "ms linear");
    const boundAnimationFrame = animationFrame.bind(this);
    let startTime = null;
    function animationFrame() {
      this.animationFrameHandle = 0;
      if (!startTime) {
        this.contentElement.style.setProperty(animatedMarginPropertyName, marginTo);
        startTime = window.performance.now();
      } else if (window.performance.now() < startTime + animationTime) {
        if (this.mainWidgetInternal) {
          this.mainWidgetInternal.doResize();
        }
      } else {
        this.cancelAnimation();
        if (this.mainWidgetInternal) {
          this.mainWidgetInternal.doResize();
        }
        this.dispatchEventToListeners(Events.SidebarSizeChanged, this.sidebarSize());
        return;
      }
      this.animationFrameHandle = this.contentElement.window().requestAnimationFrame(boundAnimationFrame);
    }
    this.animationFrameHandle = this.contentElement.window().requestAnimationFrame(boundAnimationFrame);
  }
  cancelAnimation() {
    this.contentElement.style.removeProperty("margin-top");
    this.contentElement.style.removeProperty("margin-right");
    this.contentElement.style.removeProperty("margin-bottom");
    this.contentElement.style.removeProperty("margin-left");
    this.contentElement.style.removeProperty("transition");
    if (this.animationFrameHandle) {
      this.contentElement.window().cancelAnimationFrame(this.animationFrameHandle);
      this.animationFrameHandle = 0;
    }
    if (this.animationCallback) {
      this.animationCallback();
      this.animationCallback = null;
    }
  }
  applyConstraints(sidebarSize, userAction) {
    const totalSize = this.totalSizeDIP();
    const zoomFactor = this.constraintsInDip ? 1 : ZoomManager.instance().zoomFactor();
    let constraints = this.sidebarWidgetInternal ? this.sidebarWidgetInternal.constraints() : new Constraints();
    let minSidebarSize = this.isVertical() ? constraints.minimum.width : constraints.minimum.height;
    if (!minSidebarSize) {
      minSidebarSize = MinPadding;
    }
    minSidebarSize *= zoomFactor;
    if (this.sidebarMinimized) {
      sidebarSize = minSidebarSize;
    }
    let preferredSidebarSize = this.isVertical() ? constraints.preferred.width : constraints.preferred.height;
    if (!preferredSidebarSize) {
      preferredSidebarSize = MinPadding;
    }
    preferredSidebarSize *= zoomFactor;
    if (sidebarSize < preferredSidebarSize) {
      preferredSidebarSize = Math.max(sidebarSize, minSidebarSize);
    }
    preferredSidebarSize += zoomFactor;
    constraints = this.mainWidgetInternal ? this.mainWidgetInternal.constraints() : new Constraints();
    let minMainSize = this.isVertical() ? constraints.minimum.width : constraints.minimum.height;
    if (!minMainSize) {
      minMainSize = MinPadding;
    }
    minMainSize *= zoomFactor;
    let preferredMainSize = this.isVertical() ? constraints.preferred.width : constraints.preferred.height;
    if (!preferredMainSize) {
      preferredMainSize = MinPadding;
    }
    preferredMainSize *= zoomFactor;
    const savedMainSize = this.isVertical() ? this.savedVerticalMainSize : this.savedHorizontalMainSize;
    if (savedMainSize !== null) {
      preferredMainSize = Math.min(preferredMainSize, savedMainSize * zoomFactor);
    }
    if (userAction) {
      preferredMainSize = minMainSize;
    }
    const totalPreferred = preferredMainSize + preferredSidebarSize;
    if (totalPreferred <= totalSize) {
      return Platform.NumberUtilities.clamp(sidebarSize, preferredSidebarSize, totalSize - preferredMainSize);
    }
    if (minMainSize + minSidebarSize <= totalSize) {
      const delta = totalPreferred - totalSize;
      const sidebarDelta = delta * preferredSidebarSize / totalPreferred;
      sidebarSize = preferredSidebarSize - sidebarDelta;
      return Platform.NumberUtilities.clamp(sidebarSize, minSidebarSize, totalSize - minMainSize);
    }
    return Math.max(0, totalSize - minMainSize);
  }
  wasShown() {
    this.forceUpdateLayout();
    ZoomManager.instance().addEventListener(ZoomManagerEvents.ZoomChanged, this.onZoomChanged, this);
  }
  willHide() {
    ZoomManager.instance().removeEventListener(ZoomManagerEvents.ZoomChanged, this.onZoomChanged, this);
  }
  onResize() {
    this.updateLayout();
  }
  onLayout() {
    this.updateLayout();
  }
  calculateConstraints() {
    if (this.showModeInternal === ShowMode.OnlyMain) {
      return this.mainWidgetInternal ? this.mainWidgetInternal.constraints() : new Constraints();
    }
    if (this.showModeInternal === ShowMode.OnlySidebar) {
      return this.sidebarWidgetInternal ? this.sidebarWidgetInternal.constraints() : new Constraints();
    }
    let mainConstraints = this.mainWidgetInternal ? this.mainWidgetInternal.constraints() : new Constraints();
    let sidebarConstraints = this.sidebarWidgetInternal ? this.sidebarWidgetInternal.constraints() : new Constraints();
    const min = MinPadding;
    if (this.isVerticalInternal) {
      mainConstraints = mainConstraints.widthToMax(min).addWidth(1);
      sidebarConstraints = sidebarConstraints.widthToMax(min);
      return mainConstraints.addWidth(sidebarConstraints).heightToMax(sidebarConstraints);
    }
    mainConstraints = mainConstraints.heightToMax(min).addHeight(1);
    sidebarConstraints = sidebarConstraints.heightToMax(min);
    return mainConstraints.widthToMax(sidebarConstraints).addHeight(sidebarConstraints);
  }
  onResizeStart() {
    this.resizeStartSizeDIP = this.sidebarSizeDIP;
  }
  onResizeUpdate(event) {
    const offset = event.data.currentPosition - event.data.startPosition;
    const offsetDIP = ZoomManager.instance().cssToDIP(offset);
    const newSizeDIP = this.secondIsSidebar ? this.resizeStartSizeDIP - offsetDIP : this.resizeStartSizeDIP + offsetDIP;
    const constrainedSizeDIP = this.applyConstraints(newSizeDIP, true);
    this.savedSidebarSizeDIP = constrainedSizeDIP;
    this.saveSetting();
    this.innerSetSidebarSizeDIP(constrainedSizeDIP, false, true);
    if (this.isVertical()) {
      this.savedVerticalMainSize = this.totalSizeDIP() - this.sidebarSizeDIP;
    } else {
      this.savedHorizontalMainSize = this.totalSizeDIP() - this.sidebarSizeDIP;
    }
  }
  onResizeEnd() {
    this.resizeStartSizeDIP = 0;
  }
  hideDefaultResizer(noSplitter) {
    this.uninstallResizer(this.resizerElementInternal);
    this.sidebarElementInternal.classList.toggle("no-default-splitter", Boolean(noSplitter));
  }
  installResizer(resizerElement) {
    this.resizerWidget.addElement(resizerElement);
  }
  uninstallResizer(resizerElement) {
    this.resizerWidget.removeElement(resizerElement);
  }
  hasCustomResizer() {
    const elements = this.resizerWidget.elements();
    return elements.length > 1 || elements.length === 1 && elements[0] !== this.resizerElementInternal;
  }
  toggleResizer(resizer, on) {
    if (on) {
      this.installResizer(resizer);
    } else {
      this.uninstallResizer(resizer);
    }
  }
  settingForOrientation() {
    const state = this.setting ? this.setting.get() : {};
    return this.isVerticalInternal ? state.vertical : state.horizontal;
  }
  preferredSidebarSizeDIP() {
    let size = this.savedSidebarSizeDIP;
    if (!size) {
      size = this.isVerticalInternal ? this.defaultSidebarWidth : this.defaultSidebarHeight;
      if (0 < size && size < 1) {
        size *= this.totalSizeDIP();
      }
    }
    return size;
  }
  restoreSidebarSizeFromSettings() {
    const settingForOrientation = this.settingForOrientation();
    this.savedSidebarSizeDIP = settingForOrientation ? settingForOrientation.size : 0;
  }
  restoreAndApplyShowModeFromSettings() {
    const orientationState = this.settingForOrientation();
    this.savedShowMode = orientationState && orientationState.showMode ? orientationState.showMode : this.showModeInternal;
    this.showModeInternal = this.savedShowMode;
    switch (this.savedShowMode) {
      case ShowMode.Both:
        this.showBoth();
        break;
      case ShowMode.OnlyMain:
        this.hideSidebar();
        break;
      case ShowMode.OnlySidebar:
        this.hideMain();
        break;
    }
  }
  saveShowModeToSettings() {
    this.savedShowMode = this.showModeInternal;
    this.saveSetting();
  }
  saveSetting() {
    if (!this.setting) {
      return;
    }
    const state = this.setting.get();
    const orientationState = (this.isVerticalInternal ? state.vertical : state.horizontal) || {};
    orientationState.size = this.savedSidebarSizeDIP;
    if (this.shouldSaveShowMode) {
      orientationState.showMode = this.savedShowMode;
    }
    if (this.isVerticalInternal) {
      state.vertical = orientationState;
    } else {
      state.horizontal = orientationState;
    }
    this.setting.set(state);
  }
  forceUpdateLayout() {
    this.sidebarSizeDIP = -1;
    this.updateLayout();
  }
  onZoomChanged() {
    this.forceUpdateLayout();
  }
  createShowHideSidebarButton(showTitle, hideTitle, shownString, hiddenString) {
    this.showSidebarButtonTitle = showTitle;
    this.hideSidebarButtonTitle = hideTitle;
    this.shownSidebarString = shownString;
    this.hiddenSidebarString = hiddenString;
    this.showHideSidebarButton = new ToolbarButton("", "");
    this.showHideSidebarButton.addEventListener(ToolbarButton.Events.Click, buttonClicked, this);
    this.updateShowHideSidebarButton();
    function buttonClicked() {
      this.toggleSidebar();
    }
    return this.showHideSidebarButton;
  }
  toggleSidebar() {
    if (this.showModeInternal !== ShowMode.Both) {
      this.showBoth(true);
      ARIAUtils.alert(this.shownSidebarString);
    } else {
      this.hideSidebar(true);
      ARIAUtils.alert(this.hiddenSidebarString);
    }
  }
  updateShowHideSidebarButton() {
    if (!this.showHideSidebarButton) {
      return;
    }
    const sidebarHidden = this.showModeInternal === ShowMode.OnlyMain;
    let glyph = "";
    if (sidebarHidden) {
      glyph = this.isVertical() ? this.isSidebarSecond() ? "largeicon-show-right-sidebar" : "largeicon-show-left-sidebar" : this.isSidebarSecond() ? "largeicon-show-bottom-sidebar" : "largeicon-show-top-sidebar";
    } else {
      glyph = this.isVertical() ? this.isSidebarSecond() ? "largeicon-hide-right-sidebar" : "largeicon-hide-left-sidebar" : this.isSidebarSecond() ? "largeicon-hide-bottom-sidebar" : "largeicon-hide-top-sidebar";
    }
    this.showHideSidebarButton.setGlyph(glyph);
    this.showHideSidebarButton.setTitle(sidebarHidden ? this.showSidebarButtonTitle : this.hideSidebarButtonTitle);
  }
}
export var ShowMode = /* @__PURE__ */ ((ShowMode2) => {
  ShowMode2["Both"] = "Both";
  ShowMode2["OnlyMain"] = "OnlyMain";
  ShowMode2["OnlySidebar"] = "OnlySidebar";
  return ShowMode2;
})(ShowMode || {});
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["SidebarSizeChanged"] = "SidebarSizeChanged";
  Events2["ShowModeChanged"] = "ShowModeChanged";
  return Events2;
})(Events || {});
const MinPadding = 20;
const suppressUnused = function(_value) {
};
//# sourceMappingURL=SplitWidget.js.map
