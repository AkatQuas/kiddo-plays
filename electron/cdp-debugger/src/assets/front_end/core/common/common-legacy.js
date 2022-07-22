import * as CommonModule from "./common.js";
self.Common = self.Common || {};
Common = Common || {};
Common.App = CommonModule.App.App;
Common.AppProvider = CommonModule.AppProvider.AppProvider;
Common.Color = CommonModule.Color.Color;
Common.Color.Format = CommonModule.Color.Format;
Common.console = CommonModule.Console.Console.instance();
Common.Console = CommonModule.Console.Console;
Common.EventTarget = {
  removeEventListeners: CommonModule.EventTarget.removeEventListeners
};
Common.JavaScriptMetadata = CommonModule.JavaScriptMetaData.JavaScriptMetaData;
Common.Linkifier = CommonModule.Linkifier.Linkifier;
Common.Object = CommonModule.ObjectWrapper.ObjectWrapper;
Common.ParsedURL = CommonModule.ParsedURL.ParsedURL;
Common.Progress = CommonModule.Progress.Progress;
Common.CompositeProgress = CommonModule.Progress.CompositeProgress;
Common.QueryParamHandler = CommonModule.QueryParamHandler.QueryParamHandler;
Common.resourceTypes = CommonModule.ResourceType.resourceTypes;
Common.Revealer = CommonModule.Revealer.Revealer;
Common.Revealer.reveal = CommonModule.Revealer.reveal;
Common.Revealer.setRevealForTest = CommonModule.Revealer.setRevealForTest;
Common.Segment = CommonModule.SegmentedRange.Segment;
Common.SegmentedRange = CommonModule.SegmentedRange.SegmentedRange;
Common.Settings = CommonModule.Settings.Settings;
Common.Settings.detectColorFormat = CommonModule.Settings.detectColorFormat;
Common.Setting = CommonModule.Settings.Setting;
Common.settingForTest = CommonModule.Settings.settingForTest;
Common.VersionController = CommonModule.Settings.VersionController;
Common.moduleSetting = CommonModule.Settings.moduleSetting;
Common.StringOutputStream = CommonModule.StringOutputStream.StringOutputStream;
Common.Throttler = CommonModule.Throttler.Throttler;
Common.Trie = CommonModule.Trie.Trie;
Common.settings;
//# sourceMappingURL=common-legacy.js.map
