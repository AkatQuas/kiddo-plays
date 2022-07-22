import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import * as UI from "../../ui/legacy/legacy.js";
import playerPropertiesViewStyles from "./playerPropertiesView.css.js";
const UIStrings = {
  video: "Video",
  audio: "Audio",
  track: "Track",
  decoder: "Decoder",
  properties: "Properties",
  textTrack: "Text track",
  noTextTracks: "No text tracks",
  resolution: "Resolution",
  fileSize: "File size",
  bitrate: "Bitrate",
  duration: "Duration",
  startTime: "Start time",
  streaming: "Streaming",
  playbackFrameUrl: "Playback frame URL",
  playbackFrameTitle: "Playback frame title",
  singleoriginPlayback: "Single-origin playback",
  rangeHeaderSupport: "`Range` header support",
  frameRate: "Frame rate",
  videoPlaybackRoughness: "Video playback roughness",
  videoFreezingScore: "Video freezing score",
  rendererName: "Renderer name",
  decoderName: "Decoder name",
  noDecoder: "No decoder",
  hardwareDecoder: "Hardware decoder",
  decryptingDemuxer: "Decrypting demuxer",
  encoderName: "Encoder name",
  noEncoder: "No encoder",
  hardwareEncoder: "Hardware encoder"
};
const str_ = i18n.i18n.registerUIStrings("panels/media/PlayerPropertiesView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export var PlayerPropertyKeys = /* @__PURE__ */ ((PlayerPropertyKeys2) => {
  PlayerPropertyKeys2["Resolution"] = "kResolution";
  PlayerPropertyKeys2["TotalBytes"] = "kTotalBytes";
  PlayerPropertyKeys2["Bitrate"] = "kBitrate";
  PlayerPropertyKeys2["MaxDuration"] = "kMaxDuration";
  PlayerPropertyKeys2["StartTime"] = "kStartTime";
  PlayerPropertyKeys2["IsVideoEncrypted"] = "kIsVideoEncrypted";
  PlayerPropertyKeys2["IsStreaming"] = "kIsStreaming";
  PlayerPropertyKeys2["FrameUrl"] = "kFrameUrl";
  PlayerPropertyKeys2["FrameTitle"] = "kFrameTitle";
  PlayerPropertyKeys2["IsSingleOrigin"] = "kIsSingleOrigin";
  PlayerPropertyKeys2["IsRangeHeaderSupported"] = "kIsRangeHeaderSupported";
  PlayerPropertyKeys2["RendererName"] = "kRendererName";
  PlayerPropertyKeys2["VideoDecoderName"] = "kVideoDecoderName";
  PlayerPropertyKeys2["AudioDecoderName"] = "kAudioDecoderName";
  PlayerPropertyKeys2["IsPlatformVideoDecoder"] = "kIsPlatformVideoDecoder";
  PlayerPropertyKeys2["IsPlatformAudioDecoder"] = "kIsPlatformAudioDecoder";
  PlayerPropertyKeys2["VideoEncoderName"] = "kVideoEncoderName";
  PlayerPropertyKeys2["IsPlatformVideoEncoder"] = "kIsPlatformVideoEncoder";
  PlayerPropertyKeys2["IsVideoDecryptingDemuxerStream"] = "kIsVideoDecryptingDemuxerStream";
  PlayerPropertyKeys2["IsAudioDecryptingDemuxerStream"] = "kIsAudioDecryptingDemuxerStream";
  PlayerPropertyKeys2["AudioTracks"] = "kAudioTracks";
  PlayerPropertyKeys2["TextTracks"] = "kTextTracks";
  PlayerPropertyKeys2["VideoTracks"] = "kVideoTracks";
  PlayerPropertyKeys2["Framerate"] = "kFramerate";
  PlayerPropertyKeys2["VideoPlaybackRoughness"] = "kVideoPlaybackRoughness";
  PlayerPropertyKeys2["VideoPlaybackFreezing"] = "kVideoPlaybackFreezing";
  return PlayerPropertyKeys2;
})(PlayerPropertyKeys || {});
export class PropertyRenderer extends UI.Widget.VBox {
  title;
  contents;
  value;
  pseudoColorProtectionElement;
  constructor(title) {
    super();
    this.contentElement.classList.add("media-property-renderer");
    const titleElement = this.contentElement.createChild("span", "media-property-renderer-title");
    this.contents = this.contentElement.createChild("span", "media-property-renderer-contents");
    UI.UIUtils.createTextChild(titleElement, title);
    this.title = title;
    this.value = null;
    this.pseudoColorProtectionElement = null;
    this.contentElement.classList.add("media-property-renderer-hidden");
  }
  updateData(propname, propvalue) {
    if (propvalue === "" || propvalue === null) {
      return this.updateDataInternal(propname, null);
    }
    try {
      propvalue = JSON.parse(propvalue);
    } catch (err) {
    }
    return this.updateDataInternal(propname, propvalue);
  }
  updateDataInternal(propname, propvalue) {
    if (propvalue === null) {
      this.changeContents(null);
    } else if (this.value === propvalue) {
      return;
    } else {
      this.value = propvalue;
      this.changeContents(propvalue);
    }
  }
  changeContents(value) {
    if (value === null) {
      this.contentElement.classList.add("media-property-renderer-hidden");
      if (this.pseudoColorProtectionElement === null) {
        this.pseudoColorProtectionElement = document.createElement("div");
        this.pseudoColorProtectionElement.classList.add("media-property-renderer");
        this.pseudoColorProtectionElement.classList.add("media-property-renderer-hidden");
        this.contentElement.parentNode.insertBefore(this.pseudoColorProtectionElement, this.contentElement);
      }
    } else {
      if (this.pseudoColorProtectionElement !== null) {
        this.pseudoColorProtectionElement.remove();
        this.pseudoColorProtectionElement = null;
      }
      this.contentElement.classList.remove("media-property-renderer-hidden");
      this.contents.removeChildren();
      const spanElement = document.createElement("span");
      spanElement.textContent = value;
      this.contents.appendChild(spanElement);
    }
  }
}
export class FormattedPropertyRenderer extends PropertyRenderer {
  formatfunction;
  constructor(title, formatfunction) {
    super(title);
    this.formatfunction = formatfunction;
  }
  updateDataInternal(propname, propvalue) {
    if (propvalue === null) {
      this.changeContents(null);
    } else {
      this.changeContents(this.formatfunction(propvalue));
    }
  }
}
export class DefaultPropertyRenderer extends PropertyRenderer {
  constructor(title, defaultText) {
    super(title);
    this.changeContents(defaultText);
  }
}
export class DimensionPropertyRenderer extends PropertyRenderer {
  width;
  height;
  constructor(title) {
    super(title);
    this.width = 0;
    this.height = 0;
  }
  updateDataInternal(propname, propvalue) {
    let needsUpdate = false;
    if (propname === "width" && Number(propvalue) !== this.width) {
      this.width = Number(propvalue);
      needsUpdate = true;
    }
    if (propname === "height" && Number(propvalue) !== this.height) {
      this.height = Number(propvalue);
      needsUpdate = true;
    }
    if (this.width === 0 || this.height === 0) {
      this.changeContents(null);
    } else if (needsUpdate) {
      this.changeContents(`${this.width}\xD7${this.height}`);
    }
  }
}
export class AttributesView extends UI.Widget.VBox {
  contentHash;
  constructor(elements) {
    super();
    this.contentHash = 0;
    this.contentElement.classList.add("media-attributes-view");
    for (const element of elements) {
      element.show(this.contentElement);
      const content = this.contentElement.textContent;
      if (content !== null) {
        this.contentHash += Platform.StringUtilities.hashCode(content);
      }
    }
  }
  getContentHash() {
    return this.contentHash;
  }
}
export class TrackManager {
  type;
  view;
  constructor(propertiesView, type) {
    this.type = type;
    this.view = propertiesView;
  }
  updateData(_name, value) {
    const tabs = this.view.getTabs(this.type);
    const newTabs = JSON.parse(value);
    let enumerate = 1;
    for (const tabData of newTabs) {
      this.addNewTab(tabs, tabData, enumerate);
      enumerate++;
    }
  }
  addNewTab(tabs, tabData, tabNumber) {
    const tabElements = [];
    for (const [name, data] of Object.entries(tabData)) {
      tabElements.push(new DefaultPropertyRenderer(i18n.i18n.lockedString(name), data));
    }
    const newTab = new AttributesView(tabElements);
    tabs.addNewTab(tabNumber, newTab);
  }
}
export class VideoTrackManager extends TrackManager {
  constructor(propertiesView) {
    super(propertiesView, "video");
  }
}
export class TextTrackManager extends TrackManager {
  constructor(propertiesView) {
    super(propertiesView, "text");
  }
}
export class AudioTrackManager extends TrackManager {
  constructor(propertiesView) {
    super(propertiesView, "audio");
  }
}
const TrackTypeLocalized = {
  Video: i18nLazyString(UIStrings.video),
  Audio: i18nLazyString(UIStrings.audio)
};
class GenericTrackMenu extends UI.TabbedPane.TabbedPane {
  decoderName;
  trackName;
  constructor(decoderName, trackName = i18nString(UIStrings.track)) {
    super();
    this.decoderName = decoderName;
    this.trackName = trackName;
  }
  addNewTab(trackNumber, element) {
    const localizedTrackLower = i18nString(UIStrings.track);
    const tabId = `Track${trackNumber}`;
    if (this.hasTab(tabId)) {
      const tabElement = this.tabView(tabId);
      if (tabElement === null) {
        return;
      }
      if (tabElement.getContentHash() === element.getContentHash()) {
        return;
      }
      this.closeTab(tabId, false);
    }
    this.appendTab(tabId, `${this.trackName} #${trackNumber}`, element, `${this.decoderName} ${localizedTrackLower} #${trackNumber}`);
  }
}
class DecoderTrackMenu extends GenericTrackMenu {
  constructor(decoderName, informationalElement) {
    super(decoderName);
    const decoderLocalized = i18nString(UIStrings.decoder);
    const title = `${decoderName} ${decoderLocalized}`;
    const propertiesLocalized = i18nString(UIStrings.properties);
    const hoverText = `${title} ${propertiesLocalized}`;
    this.appendTab("DecoderProperties", title, informationalElement, hoverText);
  }
}
class NoTracksPlaceholderMenu extends UI.Widget.VBox {
  isPlaceholder;
  wrapping;
  constructor(wrapping, placeholderText) {
    super();
    this.isPlaceholder = true;
    this.wrapping = wrapping;
    this.wrapping.appendTab("_placeholder", placeholderText, new UI.Widget.VBox(), placeholderText);
    this.wrapping.show(this.contentElement);
  }
  addNewTab(trackNumber, element) {
    if (this.isPlaceholder) {
      this.wrapping.closeTab("_placeholder");
      this.isPlaceholder = false;
    }
    this.wrapping.addNewTab(trackNumber, element);
  }
}
export class PlayerPropertiesView extends UI.Widget.VBox {
  mediaElements;
  videoDecoderElements;
  audioDecoderElements;
  textTrackElements;
  attributeMap;
  videoProperties;
  videoDecoderProperties;
  audioDecoderProperties;
  videoDecoderTabs;
  audioDecoderTabs;
  textTracksTabs;
  constructor() {
    super();
    this.contentElement.classList.add("media-properties-frame");
    this.mediaElements = [];
    this.videoDecoderElements = [];
    this.audioDecoderElements = [];
    this.textTrackElements = [];
    this.attributeMap = /* @__PURE__ */ new Map();
    this.populateAttributesAndElements();
    this.videoProperties = new AttributesView(this.mediaElements);
    this.videoDecoderProperties = new AttributesView(this.videoDecoderElements);
    this.audioDecoderProperties = new AttributesView(this.audioDecoderElements);
    this.videoProperties.show(this.contentElement);
    this.videoDecoderTabs = new DecoderTrackMenu(TrackTypeLocalized.Video(), this.videoDecoderProperties);
    this.videoDecoderTabs.show(this.contentElement);
    this.audioDecoderTabs = new DecoderTrackMenu(TrackTypeLocalized.Audio(), this.audioDecoderProperties);
    this.audioDecoderTabs.show(this.contentElement);
    this.textTracksTabs = null;
  }
  lazyCreateTrackTabs() {
    let textTracksTabs = this.textTracksTabs;
    if (textTracksTabs === null) {
      const textTracks = new GenericTrackMenu(i18nString(UIStrings.textTrack));
      textTracksTabs = new NoTracksPlaceholderMenu(textTracks, i18nString(UIStrings.noTextTracks));
      textTracksTabs.show(this.contentElement);
      this.textTracksTabs = textTracksTabs;
    }
    return textTracksTabs;
  }
  getTabs(type) {
    if (type === "audio") {
      return this.audioDecoderTabs;
    }
    if (type === "video") {
      return this.videoDecoderTabs;
    }
    if (type === "text") {
      return this.lazyCreateTrackTabs();
    }
    throw new Error("Unreachable");
  }
  onProperty(property) {
    const renderer = this.attributeMap.get(property.name);
    if (!renderer) {
      throw new Error(`Player property "${property.name}" not supported.`);
    }
    renderer.updateData(property.name, property.value);
  }
  formatKbps(bitsPerSecond) {
    if (bitsPerSecond === "") {
      return "0 kbps";
    }
    const kbps = Math.floor(Number(bitsPerSecond) / 1e3);
    return `${kbps} kbps`;
  }
  formatTime(seconds) {
    if (seconds === "") {
      return "0:00";
    }
    const date = new Date();
    date.setSeconds(Number(seconds));
    return date.toISOString().substr(11, 8);
  }
  formatFileSize(bytes) {
    if (bytes === "") {
      return "0 bytes";
    }
    const actualBytes = Number(bytes);
    if (actualBytes < 1e3) {
      return `${bytes} bytes`;
    }
    const power = Math.floor(Math.log10(actualBytes) / 3);
    const suffix = ["bytes", "kB", "MB", "GB", "TB"][power];
    const bytesDecimal = (actualBytes / Math.pow(1e3, power)).toFixed(2);
    return `${bytesDecimal} ${suffix}`;
  }
  populateAttributesAndElements() {
    const resolution = new PropertyRenderer(i18nString(UIStrings.resolution));
    this.mediaElements.push(resolution);
    this.attributeMap.set("kResolution" /* Resolution */, resolution);
    const fileSize = new FormattedPropertyRenderer(i18nString(UIStrings.fileSize), this.formatFileSize);
    this.mediaElements.push(fileSize);
    this.attributeMap.set("kTotalBytes" /* TotalBytes */, fileSize);
    const bitrate = new FormattedPropertyRenderer(i18nString(UIStrings.bitrate), this.formatKbps);
    this.mediaElements.push(bitrate);
    this.attributeMap.set("kBitrate" /* Bitrate */, bitrate);
    const duration = new FormattedPropertyRenderer(i18nString(UIStrings.duration), this.formatTime);
    this.mediaElements.push(duration);
    this.attributeMap.set("kMaxDuration" /* MaxDuration */, duration);
    const startTime = new PropertyRenderer(i18nString(UIStrings.startTime));
    this.mediaElements.push(startTime);
    this.attributeMap.set("kStartTime" /* StartTime */, startTime);
    const streaming = new PropertyRenderer(i18nString(UIStrings.streaming));
    this.mediaElements.push(streaming);
    this.attributeMap.set("kIsStreaming" /* IsStreaming */, streaming);
    const frameUrl = new PropertyRenderer(i18nString(UIStrings.playbackFrameUrl));
    this.mediaElements.push(frameUrl);
    this.attributeMap.set("kFrameUrl" /* FrameUrl */, frameUrl);
    const frameTitle = new PropertyRenderer(i18nString(UIStrings.playbackFrameTitle));
    this.mediaElements.push(frameTitle);
    this.attributeMap.set("kFrameTitle" /* FrameTitle */, frameTitle);
    const singleOrigin = new PropertyRenderer(i18nString(UIStrings.singleoriginPlayback));
    this.mediaElements.push(singleOrigin);
    this.attributeMap.set("kIsSingleOrigin" /* IsSingleOrigin */, singleOrigin);
    const rangeHeaders = new PropertyRenderer(i18nString(UIStrings.rangeHeaderSupport));
    this.mediaElements.push(rangeHeaders);
    this.attributeMap.set("kIsRangeHeaderSupported" /* IsRangeHeaderSupported */, rangeHeaders);
    const frameRate = new PropertyRenderer(i18nString(UIStrings.frameRate));
    this.mediaElements.push(frameRate);
    this.attributeMap.set("kFramerate" /* Framerate */, frameRate);
    const roughness = new PropertyRenderer(i18nString(UIStrings.videoPlaybackRoughness));
    this.mediaElements.push(roughness);
    this.attributeMap.set("kVideoPlaybackRoughness" /* VideoPlaybackRoughness */, roughness);
    const freezingScore = new PropertyRenderer(i18nString(UIStrings.videoFreezingScore));
    this.mediaElements.push(freezingScore);
    this.attributeMap.set("kVideoPlaybackFreezing" /* VideoPlaybackFreezing */, freezingScore);
    const rendererName = new PropertyRenderer(i18nString(UIStrings.rendererName));
    this.mediaElements.push(rendererName);
    this.attributeMap.set("kRendererName" /* RendererName */, rendererName);
    const decoderName = new DefaultPropertyRenderer(i18nString(UIStrings.decoderName), i18nString(UIStrings.noDecoder));
    this.videoDecoderElements.push(decoderName);
    this.attributeMap.set("kVideoDecoderName" /* VideoDecoderName */, decoderName);
    const videoPlatformDecoder = new PropertyRenderer(i18nString(UIStrings.hardwareDecoder));
    this.videoDecoderElements.push(videoPlatformDecoder);
    this.attributeMap.set("kIsPlatformVideoDecoder" /* IsPlatformVideoDecoder */, videoPlatformDecoder);
    const encoderName = new DefaultPropertyRenderer(i18nString(UIStrings.encoderName), i18nString(UIStrings.noEncoder));
    this.videoDecoderElements.push(encoderName);
    this.attributeMap.set("kVideoEncoderName" /* VideoEncoderName */, encoderName);
    const videoPlatformEncoder = new PropertyRenderer(i18nString(UIStrings.hardwareEncoder));
    this.videoDecoderElements.push(videoPlatformEncoder);
    this.attributeMap.set("kIsPlatformVideoEncoder" /* IsPlatformVideoEncoder */, videoPlatformEncoder);
    const videoDDS = new PropertyRenderer(i18nString(UIStrings.decryptingDemuxer));
    this.videoDecoderElements.push(videoDDS);
    this.attributeMap.set("kIsVideoDecryptingDemuxerStream" /* IsVideoDecryptingDemuxerStream */, videoDDS);
    const videoTrackManager = new VideoTrackManager(this);
    this.attributeMap.set("kVideoTracks" /* VideoTracks */, videoTrackManager);
    const audioDecoder = new DefaultPropertyRenderer(i18nString(UIStrings.decoderName), i18nString(UIStrings.noDecoder));
    this.audioDecoderElements.push(audioDecoder);
    this.attributeMap.set("kAudioDecoderName" /* AudioDecoderName */, audioDecoder);
    const audioPlatformDecoder = new PropertyRenderer(i18nString(UIStrings.hardwareDecoder));
    this.audioDecoderElements.push(audioPlatformDecoder);
    this.attributeMap.set("kIsPlatformAudioDecoder" /* IsPlatformAudioDecoder */, audioPlatformDecoder);
    const audioDDS = new PropertyRenderer(i18nString(UIStrings.decryptingDemuxer));
    this.audioDecoderElements.push(audioDDS);
    this.attributeMap.set("kIsAudioDecryptingDemuxerStream" /* IsAudioDecryptingDemuxerStream */, audioDDS);
    const audioTrackManager = new AudioTrackManager(this);
    this.attributeMap.set("kAudioTracks" /* AudioTracks */, audioTrackManager);
    const textTrackManager = new TextTrackManager(this);
    this.attributeMap.set("kTextTracks" /* TextTracks */, textTrackManager);
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([playerPropertiesViewStyles]);
  }
}
//# sourceMappingURL=PlayerPropertiesView.js.map
