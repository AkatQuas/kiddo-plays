import { InspectorFrontendHostInstance } from "./InspectorFrontendHost.js";
import { EnumeratedHistogram } from "./InspectorFrontendHostAPI.js";
export class UserMetrics {
  #panelChangedSinceLaunch;
  #firedLaunchHistogram;
  #launchPanelName;
  constructor() {
    this.#panelChangedSinceLaunch = false;
    this.#firedLaunchHistogram = false;
    this.#launchPanelName = "";
  }
  panelShown(panelName) {
    const code = PanelCodes[panelName] || 0;
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.PanelShown, code, PanelCodes.MaxValue);
    this.#panelChangedSinceLaunch = true;
  }
  panelClosed(panelName) {
    const code = PanelCodes[panelName] || 0;
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.PanelClosed, code, PanelCodes.MaxValue);
    this.#panelChangedSinceLaunch = true;
  }
  sidebarPaneShown(sidebarPaneName) {
    const code = SidebarPaneCodes[sidebarPaneName] || 0;
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.SidebarPaneShown, code, SidebarPaneCodes.MaxValue);
  }
  settingsPanelShown(settingsViewId) {
    this.panelShown("settings-" + settingsViewId);
  }
  actionTaken(action) {
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.ActionTaken, action, Action.MaxValue);
  }
  panelLoaded(panelName, histogramName) {
    if (this.#firedLaunchHistogram || panelName !== this.#launchPanelName) {
      return;
    }
    this.#firedLaunchHistogram = true;
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        performance.mark(histogramName);
        if (this.#panelChangedSinceLaunch) {
          return;
        }
        InspectorFrontendHostInstance.recordPerformanceHistogram(histogramName, performance.now());
      }, 0);
    });
  }
  setLaunchPanel(panelName) {
    this.#launchPanelName = panelName;
  }
  keybindSetSettingChanged(keybindSet) {
    const value = KeybindSetSettings[keybindSet] || 0;
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.KeybindSetSettingChanged, value, KeybindSetSettings.MaxValue);
  }
  keyboardShortcutFired(actionId) {
    const action = KeyboardShortcutAction[actionId] || KeyboardShortcutAction.OtherShortcut;
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.KeyboardShortcutFired, action, KeyboardShortcutAction.MaxValue);
  }
  issuesPanelOpenedFrom(issueOpener) {
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.IssuesPanelOpenedFrom, issueOpener, IssueOpener.MaxValue);
  }
  issuesPanelIssueExpanded(issueExpandedCategory) {
    if (issueExpandedCategory === void 0) {
      return;
    }
    const issueExpanded = IssueExpanded[issueExpandedCategory];
    if (issueExpanded === void 0) {
      return;
    }
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.IssuesPanelIssueExpanded, issueExpanded, IssueExpanded.MaxValue);
  }
  issuesPanelResourceOpened(issueCategory, type) {
    const key = issueCategory + type;
    const value = IssueResourceOpened[key];
    if (value === void 0) {
      return;
    }
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.IssuesPanelResourceOpened, value, IssueResourceOpened.MaxValue);
  }
  issueCreated(code) {
    const issueCreated = IssueCreated[code];
    if (issueCreated === void 0) {
      return;
    }
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.IssueCreated, issueCreated, IssueCreated.MaxValue);
  }
  experimentEnabledAtLaunch(experimentId) {
    const experiment = DevtoolsExperiments[experimentId];
    if (experiment === void 0) {
      return;
    }
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.ExperimentEnabledAtLaunch, experiment, DevtoolsExperiments.MaxValue);
  }
  experimentChanged(experimentId, isEnabled) {
    const experiment = DevtoolsExperiments[experimentId];
    if (experiment === void 0) {
      return;
    }
    const actionName = isEnabled ? EnumeratedHistogram.ExperimentEnabled : EnumeratedHistogram.ExperimentDisabled;
    InspectorFrontendHostInstance.recordEnumeratedHistogram(actionName, experiment, DevtoolsExperiments.MaxValue);
  }
  developerResourceLoaded(developerResourceLoaded) {
    if (developerResourceLoaded >= DeveloperResourceLoaded.MaxValue) {
      return;
    }
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.DeveloperResourceLoaded, developerResourceLoaded, DeveloperResourceLoaded.MaxValue);
  }
  developerResourceScheme(developerResourceScheme) {
    if (developerResourceScheme >= DeveloperResourceScheme.MaxValue) {
      return;
    }
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.DeveloperResourceScheme, developerResourceScheme, DeveloperResourceScheme.MaxValue);
  }
  linearMemoryInspectorRevealedFrom(linearMemoryInspectorRevealedFrom) {
    if (linearMemoryInspectorRevealedFrom >= LinearMemoryInspectorRevealedFrom.MaxValue) {
      return;
    }
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.LinearMemoryInspectorRevealedFrom, linearMemoryInspectorRevealedFrom, LinearMemoryInspectorRevealedFrom.MaxValue);
  }
  linearMemoryInspectorTarget(linearMemoryInspectorTarget) {
    if (linearMemoryInspectorTarget >= LinearMemoryInspectorTarget.MaxValue) {
      return;
    }
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.LinearMemoryInspectorTarget, linearMemoryInspectorTarget, LinearMemoryInspectorTarget.MaxValue);
  }
  language(language) {
    const languageCode = Language[language];
    if (languageCode === void 0) {
      return;
    }
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.Language, languageCode, Language.MaxValue);
  }
  showCorsErrorsSettingChanged(show) {
    const consoleShowsCorsErrors = ConsoleShowsCorsErrors[String(show)];
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.ConsoleShowsCorsErrors, consoleShowsCorsErrors, ConsoleShowsCorsErrors.MaxValue);
  }
  syncSetting(devtoolsSyncSettingEnabled) {
    InspectorFrontendHostInstance.getSyncInformation((syncInfo) => {
      let settingValue = SyncSetting.ChromeSyncDisabled;
      if (syncInfo.isSyncActive && !syncInfo.arePreferencesSynced) {
        settingValue = SyncSetting.ChromeSyncSettingsDisabled;
      } else if (syncInfo.isSyncActive && syncInfo.arePreferencesSynced) {
        settingValue = devtoolsSyncSettingEnabled ? SyncSetting.DevToolsSyncSettingEnabled : SyncSetting.DevToolsSyncSettingDisabled;
      }
      InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.SyncSetting, settingValue, SyncSetting.MaxValue);
    });
  }
  recordingToggled(value) {
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.RecordingToggled, value, RecordingToggled.MaxValue);
  }
  recordingReplayFinished(value) {
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.RecordingReplayFinished, value, RecordingReplayFinished.MaxValue);
  }
  recordingReplaySpeed(value) {
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.RecordingReplaySpeed, value, RecordingReplaySpeed.MaxValue);
  }
  recordingReplayStarted(value) {
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.RecordingReplayStarted, value, RecordingReplayStarted.MaxValue);
  }
  recordingEdited(value) {
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.RecordingEdited, value, RecordingEdited.MaxValue);
  }
  recordingExported(value) {
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.RecordingExported, value, RecordingExported.MaxValue);
  }
  styleTextCopied(value) {
    InspectorFrontendHostInstance.recordEnumeratedHistogram(EnumeratedHistogram.StyleTextCopied, value, StyleTextCopied.MaxValue);
  }
}
export var Action = /* @__PURE__ */ ((Action2) => {
  Action2[Action2["WindowDocked"] = 1] = "WindowDocked";
  Action2[Action2["WindowUndocked"] = 2] = "WindowUndocked";
  Action2[Action2["ScriptsBreakpointSet"] = 3] = "ScriptsBreakpointSet";
  Action2[Action2["TimelineStarted"] = 4] = "TimelineStarted";
  Action2[Action2["ProfilesCPUProfileTaken"] = 5] = "ProfilesCPUProfileTaken";
  Action2[Action2["ProfilesHeapProfileTaken"] = 6] = "ProfilesHeapProfileTaken";
  Action2[Action2["ConsoleEvaluated"] = 8] = "ConsoleEvaluated";
  Action2[Action2["FileSavedInWorkspace"] = 9] = "FileSavedInWorkspace";
  Action2[Action2["DeviceModeEnabled"] = 10] = "DeviceModeEnabled";
  Action2[Action2["AnimationsPlaybackRateChanged"] = 11] = "AnimationsPlaybackRateChanged";
  Action2[Action2["RevisionApplied"] = 12] = "RevisionApplied";
  Action2[Action2["FileSystemDirectoryContentReceived"] = 13] = "FileSystemDirectoryContentReceived";
  Action2[Action2["StyleRuleEdited"] = 14] = "StyleRuleEdited";
  Action2[Action2["CommandEvaluatedInConsolePanel"] = 15] = "CommandEvaluatedInConsolePanel";
  Action2[Action2["DOMPropertiesExpanded"] = 16] = "DOMPropertiesExpanded";
  Action2[Action2["ResizedViewInResponsiveMode"] = 17] = "ResizedViewInResponsiveMode";
  Action2[Action2["TimelinePageReloadStarted"] = 18] = "TimelinePageReloadStarted";
  Action2[Action2["ConnectToNodeJSFromFrontend"] = 19] = "ConnectToNodeJSFromFrontend";
  Action2[Action2["ConnectToNodeJSDirectly"] = 20] = "ConnectToNodeJSDirectly";
  Action2[Action2["CpuThrottlingEnabled"] = 21] = "CpuThrottlingEnabled";
  Action2[Action2["CpuProfileNodeFocused"] = 22] = "CpuProfileNodeFocused";
  Action2[Action2["CpuProfileNodeExcluded"] = 23] = "CpuProfileNodeExcluded";
  Action2[Action2["SelectFileFromFilePicker"] = 24] = "SelectFileFromFilePicker";
  Action2[Action2["SelectCommandFromCommandMenu"] = 25] = "SelectCommandFromCommandMenu";
  Action2[Action2["ChangeInspectedNodeInElementsPanel"] = 26] = "ChangeInspectedNodeInElementsPanel";
  Action2[Action2["StyleRuleCopied"] = 27] = "StyleRuleCopied";
  Action2[Action2["CoverageStarted"] = 28] = "CoverageStarted";
  Action2[Action2["LighthouseStarted"] = 29] = "LighthouseStarted";
  Action2[Action2["LighthouseFinished"] = 30] = "LighthouseFinished";
  Action2[Action2["ShowedThirdPartyBadges"] = 31] = "ShowedThirdPartyBadges";
  Action2[Action2["LighthouseViewTrace"] = 32] = "LighthouseViewTrace";
  Action2[Action2["FilmStripStartedRecording"] = 33] = "FilmStripStartedRecording";
  Action2[Action2["CoverageReportFiltered"] = 34] = "CoverageReportFiltered";
  Action2[Action2["CoverageStartedPerBlock"] = 35] = "CoverageStartedPerBlock";
  Action2[Action2["SettingsOpenedFromGear-deprecated"] = 36] = "SettingsOpenedFromGear-deprecated";
  Action2[Action2["SettingsOpenedFromMenu-deprecated"] = 37] = "SettingsOpenedFromMenu-deprecated";
  Action2[Action2["SettingsOpenedFromCommandMenu-deprecated"] = 38] = "SettingsOpenedFromCommandMenu-deprecated";
  Action2[Action2["TabMovedToDrawer"] = 39] = "TabMovedToDrawer";
  Action2[Action2["TabMovedToMainPanel"] = 40] = "TabMovedToMainPanel";
  Action2[Action2["CaptureCssOverviewClicked"] = 41] = "CaptureCssOverviewClicked";
  Action2[Action2["VirtualAuthenticatorEnvironmentEnabled"] = 42] = "VirtualAuthenticatorEnvironmentEnabled";
  Action2[Action2["SourceOrderViewActivated"] = 43] = "SourceOrderViewActivated";
  Action2[Action2["UserShortcutAdded"] = 44] = "UserShortcutAdded";
  Action2[Action2["ShortcutRemoved"] = 45] = "ShortcutRemoved";
  Action2[Action2["ShortcutModified"] = 46] = "ShortcutModified";
  Action2[Action2["CustomPropertyLinkClicked"] = 47] = "CustomPropertyLinkClicked";
  Action2[Action2["CustomPropertyEdited"] = 48] = "CustomPropertyEdited";
  Action2[Action2["ServiceWorkerNetworkRequestClicked"] = 49] = "ServiceWorkerNetworkRequestClicked";
  Action2[Action2["ServiceWorkerNetworkRequestClosedQuickly"] = 50] = "ServiceWorkerNetworkRequestClosedQuickly";
  Action2[Action2["NetworkPanelServiceWorkerRespondWith"] = 51] = "NetworkPanelServiceWorkerRespondWith";
  Action2[Action2["NetworkPanelCopyValue"] = 52] = "NetworkPanelCopyValue";
  Action2[Action2["ConsoleSidebarOpened"] = 53] = "ConsoleSidebarOpened";
  Action2[Action2["PerfPanelTraceImported"] = 54] = "PerfPanelTraceImported";
  Action2[Action2["PerfPanelTraceExported"] = 55] = "PerfPanelTraceExported";
  Action2[Action2["StackFrameRestarted"] = 56] = "StackFrameRestarted";
  Action2[Action2["CaptureTestProtocolClicked"] = 57] = "CaptureTestProtocolClicked";
  Action2[Action2["MaxValue"] = 58] = "MaxValue";
  return Action2;
})(Action || {});
export var PanelCodes = /* @__PURE__ */ ((PanelCodes2) => {
  PanelCodes2[PanelCodes2["elements"] = 1] = "elements";
  PanelCodes2[PanelCodes2["resources"] = 2] = "resources";
  PanelCodes2[PanelCodes2["network"] = 3] = "network";
  PanelCodes2[PanelCodes2["sources"] = 4] = "sources";
  PanelCodes2[PanelCodes2["timeline"] = 5] = "timeline";
  PanelCodes2[PanelCodes2["heap_profiler"] = 6] = "heap_profiler";
  PanelCodes2[PanelCodes2["console"] = 8] = "console";
  PanelCodes2[PanelCodes2["layers"] = 9] = "layers";
  PanelCodes2[PanelCodes2["console-view"] = 10] = "console-view";
  PanelCodes2[PanelCodes2["animations"] = 11] = "animations";
  PanelCodes2[PanelCodes2["network.config"] = 12] = "network.config";
  PanelCodes2[PanelCodes2["rendering"] = 13] = "rendering";
  PanelCodes2[PanelCodes2["sensors"] = 14] = "sensors";
  PanelCodes2[PanelCodes2["sources.search"] = 15] = "sources.search";
  PanelCodes2[PanelCodes2["security"] = 16] = "security";
  PanelCodes2[PanelCodes2["js_profiler"] = 17] = "js_profiler";
  PanelCodes2[PanelCodes2["lighthouse"] = 18] = "lighthouse";
  PanelCodes2[PanelCodes2["coverage"] = 19] = "coverage";
  PanelCodes2[PanelCodes2["protocol-monitor"] = 20] = "protocol-monitor";
  PanelCodes2[PanelCodes2["remote-devices"] = 21] = "remote-devices";
  PanelCodes2[PanelCodes2["web-audio"] = 22] = "web-audio";
  PanelCodes2[PanelCodes2["changes.changes"] = 23] = "changes.changes";
  PanelCodes2[PanelCodes2["performance.monitor"] = 24] = "performance.monitor";
  PanelCodes2[PanelCodes2["release-note"] = 25] = "release-note";
  PanelCodes2[PanelCodes2["live_heap_profile"] = 26] = "live_heap_profile";
  PanelCodes2[PanelCodes2["sources.quick"] = 27] = "sources.quick";
  PanelCodes2[PanelCodes2["network.blocked-urls"] = 28] = "network.blocked-urls";
  PanelCodes2[PanelCodes2["settings-preferences"] = 29] = "settings-preferences";
  PanelCodes2[PanelCodes2["settings-workspace"] = 30] = "settings-workspace";
  PanelCodes2[PanelCodes2["settings-experiments"] = 31] = "settings-experiments";
  PanelCodes2[PanelCodes2["settings-blackbox"] = 32] = "settings-blackbox";
  PanelCodes2[PanelCodes2["settings-devices"] = 33] = "settings-devices";
  PanelCodes2[PanelCodes2["settings-throttling-conditions"] = 34] = "settings-throttling-conditions";
  PanelCodes2[PanelCodes2["settings-emulation-locations"] = 35] = "settings-emulation-locations";
  PanelCodes2[PanelCodes2["settings-shortcuts"] = 36] = "settings-shortcuts";
  PanelCodes2[PanelCodes2["issues-pane"] = 37] = "issues-pane";
  PanelCodes2[PanelCodes2["settings-keybinds"] = 38] = "settings-keybinds";
  PanelCodes2[PanelCodes2["cssoverview"] = 39] = "cssoverview";
  PanelCodes2[PanelCodes2["chrome_recorder"] = 40] = "chrome_recorder";
  PanelCodes2[PanelCodes2["trust_tokens"] = 41] = "trust_tokens";
  PanelCodes2[PanelCodes2["reporting_api"] = 42] = "reporting_api";
  PanelCodes2[PanelCodes2["interest_groups"] = 43] = "interest_groups";
  PanelCodes2[PanelCodes2["back_forward_cache"] = 44] = "back_forward_cache";
  PanelCodes2[PanelCodes2["service_worker_cache"] = 45] = "service_worker_cache";
  PanelCodes2[PanelCodes2["background_service_backgroundFetch"] = 46] = "background_service_backgroundFetch";
  PanelCodes2[PanelCodes2["background_service_backgroundSync"] = 47] = "background_service_backgroundSync";
  PanelCodes2[PanelCodes2["background_service_pushMessaging"] = 48] = "background_service_pushMessaging";
  PanelCodes2[PanelCodes2["background_service_notifications"] = 49] = "background_service_notifications";
  PanelCodes2[PanelCodes2["background_service_paymentHandler"] = 50] = "background_service_paymentHandler";
  PanelCodes2[PanelCodes2["background_service_periodicBackgroundSync"] = 51] = "background_service_periodicBackgroundSync";
  PanelCodes2[PanelCodes2["service_workers"] = 52] = "service_workers";
  PanelCodes2[PanelCodes2["app_manifest"] = 53] = "app_manifest";
  PanelCodes2[PanelCodes2["storage"] = 54] = "storage";
  PanelCodes2[PanelCodes2["cookies"] = 55] = "cookies";
  PanelCodes2[PanelCodes2["frame_details"] = 56] = "frame_details";
  PanelCodes2[PanelCodes2["frame_resource"] = 57] = "frame_resource";
  PanelCodes2[PanelCodes2["frame_window"] = 58] = "frame_window";
  PanelCodes2[PanelCodes2["frame_worker"] = 59] = "frame_worker";
  PanelCodes2[PanelCodes2["dom_storage"] = 60] = "dom_storage";
  PanelCodes2[PanelCodes2["indexed_db"] = 61] = "indexed_db";
  PanelCodes2[PanelCodes2["web_sql"] = 62] = "web_sql";
  PanelCodes2[PanelCodes2["performance_insights"] = 63] = "performance_insights";
  PanelCodes2[PanelCodes2["MaxValue"] = 64] = "MaxValue";
  return PanelCodes2;
})(PanelCodes || {});
export var SidebarPaneCodes = /* @__PURE__ */ ((SidebarPaneCodes2) => {
  SidebarPaneCodes2[SidebarPaneCodes2["OtherSidebarPane"] = 0] = "OtherSidebarPane";
  SidebarPaneCodes2[SidebarPaneCodes2["Styles"] = 1] = "Styles";
  SidebarPaneCodes2[SidebarPaneCodes2["Computed"] = 2] = "Computed";
  SidebarPaneCodes2[SidebarPaneCodes2["elements.layout"] = 3] = "elements.layout";
  SidebarPaneCodes2[SidebarPaneCodes2["elements.eventListeners"] = 4] = "elements.eventListeners";
  SidebarPaneCodes2[SidebarPaneCodes2["elements.domBreakpoints"] = 5] = "elements.domBreakpoints";
  SidebarPaneCodes2[SidebarPaneCodes2["elements.domProperties"] = 6] = "elements.domProperties";
  SidebarPaneCodes2[SidebarPaneCodes2["accessibility.view"] = 7] = "accessibility.view";
  SidebarPaneCodes2[SidebarPaneCodes2["MaxValue"] = 8] = "MaxValue";
  return SidebarPaneCodes2;
})(SidebarPaneCodes || {});
export var KeybindSetSettings = /* @__PURE__ */ ((KeybindSetSettings2) => {
  KeybindSetSettings2[KeybindSetSettings2["devToolsDefault"] = 0] = "devToolsDefault";
  KeybindSetSettings2[KeybindSetSettings2["vsCode"] = 1] = "vsCode";
  KeybindSetSettings2[KeybindSetSettings2["MaxValue"] = 2] = "MaxValue";
  return KeybindSetSettings2;
})(KeybindSetSettings || {});
export var KeyboardShortcutAction = /* @__PURE__ */ ((KeyboardShortcutAction2) => {
  KeyboardShortcutAction2[KeyboardShortcutAction2["OtherShortcut"] = 0] = "OtherShortcut";
  KeyboardShortcutAction2[KeyboardShortcutAction2["commandMenu.show"] = 1] = "commandMenu.show";
  KeyboardShortcutAction2[KeyboardShortcutAction2["console.clear"] = 2] = "console.clear";
  KeyboardShortcutAction2[KeyboardShortcutAction2["console.show"] = 3] = "console.show";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.step"] = 4] = "debugger.step";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.step-into"] = 5] = "debugger.step-into";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.step-out"] = 6] = "debugger.step-out";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.step-over"] = 7] = "debugger.step-over";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.toggle-breakpoint"] = 8] = "debugger.toggle-breakpoint";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.toggle-breakpoint-enabled"] = 9] = "debugger.toggle-breakpoint-enabled";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.toggle-pause"] = 10] = "debugger.toggle-pause";
  KeyboardShortcutAction2[KeyboardShortcutAction2["elements.edit-as-html"] = 11] = "elements.edit-as-html";
  KeyboardShortcutAction2[KeyboardShortcutAction2["elements.hide-element"] = 12] = "elements.hide-element";
  KeyboardShortcutAction2[KeyboardShortcutAction2["elements.redo"] = 13] = "elements.redo";
  KeyboardShortcutAction2[KeyboardShortcutAction2["elements.toggle-element-search"] = 14] = "elements.toggle-element-search";
  KeyboardShortcutAction2[KeyboardShortcutAction2["elements.undo"] = 15] = "elements.undo";
  KeyboardShortcutAction2[KeyboardShortcutAction2["main.search-in-panel.find"] = 16] = "main.search-in-panel.find";
  KeyboardShortcutAction2[KeyboardShortcutAction2["main.toggle-drawer"] = 17] = "main.toggle-drawer";
  KeyboardShortcutAction2[KeyboardShortcutAction2["network.hide-request-details"] = 18] = "network.hide-request-details";
  KeyboardShortcutAction2[KeyboardShortcutAction2["network.search"] = 19] = "network.search";
  KeyboardShortcutAction2[KeyboardShortcutAction2["network.toggle-recording"] = 20] = "network.toggle-recording";
  KeyboardShortcutAction2[KeyboardShortcutAction2["quickOpen.show"] = 21] = "quickOpen.show";
  KeyboardShortcutAction2[KeyboardShortcutAction2["settings.show"] = 22] = "settings.show";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.search"] = 23] = "sources.search";
  KeyboardShortcutAction2[KeyboardShortcutAction2["background-service.toggle-recording"] = 24] = "background-service.toggle-recording";
  KeyboardShortcutAction2[KeyboardShortcutAction2["components.collect-garbage"] = 25] = "components.collect-garbage";
  KeyboardShortcutAction2[KeyboardShortcutAction2["console.clear.history"] = 26] = "console.clear.history";
  KeyboardShortcutAction2[KeyboardShortcutAction2["console.create-pin"] = 27] = "console.create-pin";
  KeyboardShortcutAction2[KeyboardShortcutAction2["coverage.start-with-reload"] = 28] = "coverage.start-with-reload";
  KeyboardShortcutAction2[KeyboardShortcutAction2["coverage.toggle-recording"] = 29] = "coverage.toggle-recording";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.breakpoint-input-window"] = 30] = "debugger.breakpoint-input-window";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.evaluate-selection"] = 31] = "debugger.evaluate-selection";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.next-call-frame"] = 32] = "debugger.next-call-frame";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.previous-call-frame"] = 33] = "debugger.previous-call-frame";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.run-snippet"] = 34] = "debugger.run-snippet";
  KeyboardShortcutAction2[KeyboardShortcutAction2["debugger.toggle-breakpoints-active"] = 35] = "debugger.toggle-breakpoints-active";
  KeyboardShortcutAction2[KeyboardShortcutAction2["elements.capture-area-screenshot"] = 36] = "elements.capture-area-screenshot";
  KeyboardShortcutAction2[KeyboardShortcutAction2["emulation.capture-full-height-screenshot"] = 37] = "emulation.capture-full-height-screenshot";
  KeyboardShortcutAction2[KeyboardShortcutAction2["emulation.capture-node-screenshot"] = 38] = "emulation.capture-node-screenshot";
  KeyboardShortcutAction2[KeyboardShortcutAction2["emulation.capture-screenshot"] = 39] = "emulation.capture-screenshot";
  KeyboardShortcutAction2[KeyboardShortcutAction2["emulation.show-sensors"] = 40] = "emulation.show-sensors";
  KeyboardShortcutAction2[KeyboardShortcutAction2["emulation.toggle-device-mode"] = 41] = "emulation.toggle-device-mode";
  KeyboardShortcutAction2[KeyboardShortcutAction2["help.release-notes"] = 42] = "help.release-notes";
  KeyboardShortcutAction2[KeyboardShortcutAction2["help.report-issue"] = 43] = "help.report-issue";
  KeyboardShortcutAction2[KeyboardShortcutAction2["input.start-replaying"] = 44] = "input.start-replaying";
  KeyboardShortcutAction2[KeyboardShortcutAction2["input.toggle-pause"] = 45] = "input.toggle-pause";
  KeyboardShortcutAction2[KeyboardShortcutAction2["input.toggle-recording"] = 46] = "input.toggle-recording";
  KeyboardShortcutAction2[KeyboardShortcutAction2["inspector_main.focus-debuggee"] = 47] = "inspector_main.focus-debuggee";
  KeyboardShortcutAction2[KeyboardShortcutAction2["inspector_main.hard-reload"] = 48] = "inspector_main.hard-reload";
  KeyboardShortcutAction2[KeyboardShortcutAction2["inspector_main.reload"] = 49] = "inspector_main.reload";
  KeyboardShortcutAction2[KeyboardShortcutAction2["live-heap-profile.start-with-reload"] = 50] = "live-heap-profile.start-with-reload";
  KeyboardShortcutAction2[KeyboardShortcutAction2["live-heap-profile.toggle-recording"] = 51] = "live-heap-profile.toggle-recording";
  KeyboardShortcutAction2[KeyboardShortcutAction2["main.debug-reload"] = 52] = "main.debug-reload";
  KeyboardShortcutAction2[KeyboardShortcutAction2["main.next-tab"] = 53] = "main.next-tab";
  KeyboardShortcutAction2[KeyboardShortcutAction2["main.previous-tab"] = 54] = "main.previous-tab";
  KeyboardShortcutAction2[KeyboardShortcutAction2["main.search-in-panel.cancel"] = 55] = "main.search-in-panel.cancel";
  KeyboardShortcutAction2[KeyboardShortcutAction2["main.search-in-panel.find-next"] = 56] = "main.search-in-panel.find-next";
  KeyboardShortcutAction2[KeyboardShortcutAction2["main.search-in-panel.find-previous"] = 57] = "main.search-in-panel.find-previous";
  KeyboardShortcutAction2[KeyboardShortcutAction2["main.toggle-dock"] = 58] = "main.toggle-dock";
  KeyboardShortcutAction2[KeyboardShortcutAction2["main.zoom-in"] = 59] = "main.zoom-in";
  KeyboardShortcutAction2[KeyboardShortcutAction2["main.zoom-out"] = 60] = "main.zoom-out";
  KeyboardShortcutAction2[KeyboardShortcutAction2["main.zoom-reset"] = 61] = "main.zoom-reset";
  KeyboardShortcutAction2[KeyboardShortcutAction2["network-conditions.network-low-end-mobile"] = 62] = "network-conditions.network-low-end-mobile";
  KeyboardShortcutAction2[KeyboardShortcutAction2["network-conditions.network-mid-tier-mobile"] = 63] = "network-conditions.network-mid-tier-mobile";
  KeyboardShortcutAction2[KeyboardShortcutAction2["network-conditions.network-offline"] = 64] = "network-conditions.network-offline";
  KeyboardShortcutAction2[KeyboardShortcutAction2["network-conditions.network-online"] = 65] = "network-conditions.network-online";
  KeyboardShortcutAction2[KeyboardShortcutAction2["profiler.heap-toggle-recording"] = 66] = "profiler.heap-toggle-recording";
  KeyboardShortcutAction2[KeyboardShortcutAction2["profiler.js-toggle-recording"] = 67] = "profiler.js-toggle-recording";
  KeyboardShortcutAction2[KeyboardShortcutAction2["resources.clear"] = 68] = "resources.clear";
  KeyboardShortcutAction2[KeyboardShortcutAction2["settings.documentation"] = 69] = "settings.documentation";
  KeyboardShortcutAction2[KeyboardShortcutAction2["settings.shortcuts"] = 70] = "settings.shortcuts";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.add-folder-to-workspace"] = 71] = "sources.add-folder-to-workspace";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.add-to-watch"] = 72] = "sources.add-to-watch";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.close-all"] = 73] = "sources.close-all";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.close-editor-tab"] = 74] = "sources.close-editor-tab";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.create-snippet"] = 75] = "sources.create-snippet";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.go-to-line"] = 76] = "sources.go-to-line";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.go-to-member"] = 77] = "sources.go-to-member";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.jump-to-next-location"] = 78] = "sources.jump-to-next-location";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.jump-to-previous-location"] = 79] = "sources.jump-to-previous-location";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.rename"] = 80] = "sources.rename";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.save"] = 81] = "sources.save";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.save-all"] = 82] = "sources.save-all";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.switch-file"] = 83] = "sources.switch-file";
  KeyboardShortcutAction2[KeyboardShortcutAction2["timeline.jump-to-next-frame"] = 84] = "timeline.jump-to-next-frame";
  KeyboardShortcutAction2[KeyboardShortcutAction2["timeline.jump-to-previous-frame"] = 85] = "timeline.jump-to-previous-frame";
  KeyboardShortcutAction2[KeyboardShortcutAction2["timeline.load-from-file"] = 86] = "timeline.load-from-file";
  KeyboardShortcutAction2[KeyboardShortcutAction2["timeline.next-recording"] = 87] = "timeline.next-recording";
  KeyboardShortcutAction2[KeyboardShortcutAction2["timeline.previous-recording"] = 88] = "timeline.previous-recording";
  KeyboardShortcutAction2[KeyboardShortcutAction2["timeline.record-reload"] = 89] = "timeline.record-reload";
  KeyboardShortcutAction2[KeyboardShortcutAction2["timeline.save-to-file"] = 90] = "timeline.save-to-file";
  KeyboardShortcutAction2[KeyboardShortcutAction2["timeline.show-history"] = 91] = "timeline.show-history";
  KeyboardShortcutAction2[KeyboardShortcutAction2["timeline.toggle-recording"] = 92] = "timeline.toggle-recording";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.increment-css"] = 93] = "sources.increment-css";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.increment-css-by-ten"] = 94] = "sources.increment-css-by-ten";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.decrement-css"] = 95] = "sources.decrement-css";
  KeyboardShortcutAction2[KeyboardShortcutAction2["sources.decrement-css-by-ten"] = 96] = "sources.decrement-css-by-ten";
  KeyboardShortcutAction2[KeyboardShortcutAction2["layers.reset-view"] = 97] = "layers.reset-view";
  KeyboardShortcutAction2[KeyboardShortcutAction2["layers.pan-mode"] = 98] = "layers.pan-mode";
  KeyboardShortcutAction2[KeyboardShortcutAction2["layers.rotate-mode"] = 99] = "layers.rotate-mode";
  KeyboardShortcutAction2[KeyboardShortcutAction2["layers.zoom-in"] = 100] = "layers.zoom-in";
  KeyboardShortcutAction2[KeyboardShortcutAction2["layers.zoom-out"] = 101] = "layers.zoom-out";
  KeyboardShortcutAction2[KeyboardShortcutAction2["layers.up"] = 102] = "layers.up";
  KeyboardShortcutAction2[KeyboardShortcutAction2["layers.down"] = 103] = "layers.down";
  KeyboardShortcutAction2[KeyboardShortcutAction2["layers.left"] = 104] = "layers.left";
  KeyboardShortcutAction2[KeyboardShortcutAction2["layers.right"] = 105] = "layers.right";
  KeyboardShortcutAction2[KeyboardShortcutAction2["help.report-translation-issue"] = 106] = "help.report-translation-issue";
  KeyboardShortcutAction2[KeyboardShortcutAction2["rendering.toggle-prefers-color-scheme"] = 107] = "rendering.toggle-prefers-color-scheme";
  KeyboardShortcutAction2[KeyboardShortcutAction2["MaxValue"] = 108] = "MaxValue";
  return KeyboardShortcutAction2;
})(KeyboardShortcutAction || {});
export var IssueOpener = /* @__PURE__ */ ((IssueOpener2) => {
  IssueOpener2[IssueOpener2["ConsoleInfoBar"] = 0] = "ConsoleInfoBar";
  IssueOpener2[IssueOpener2["LearnMoreLinkCOEP"] = 1] = "LearnMoreLinkCOEP";
  IssueOpener2[IssueOpener2["StatusBarIssuesCounter"] = 2] = "StatusBarIssuesCounter";
  IssueOpener2[IssueOpener2["HamburgerMenu"] = 3] = "HamburgerMenu";
  IssueOpener2[IssueOpener2["Adorner"] = 4] = "Adorner";
  IssueOpener2[IssueOpener2["CommandMenu"] = 5] = "CommandMenu";
  IssueOpener2[IssueOpener2["MaxValue"] = 6] = "MaxValue";
  return IssueOpener2;
})(IssueOpener || {});
export var DevtoolsExperiments = /* @__PURE__ */ ((DevtoolsExperiments2) => {
  DevtoolsExperiments2[DevtoolsExperiments2["applyCustomStylesheet"] = 0] = "applyCustomStylesheet";
  DevtoolsExperiments2[DevtoolsExperiments2["captureNodeCreationStacks"] = 1] = "captureNodeCreationStacks";
  DevtoolsExperiments2[DevtoolsExperiments2["sourcesPrettyPrint"] = 2] = "sourcesPrettyPrint";
  DevtoolsExperiments2[DevtoolsExperiments2["backgroundServices"] = 3] = "backgroundServices";
  DevtoolsExperiments2[DevtoolsExperiments2["backgroundServicesNotifications"] = 4] = "backgroundServicesNotifications";
  DevtoolsExperiments2[DevtoolsExperiments2["backgroundServicesPaymentHandler"] = 5] = "backgroundServicesPaymentHandler";
  DevtoolsExperiments2[DevtoolsExperiments2["backgroundServicesPushMessaging"] = 6] = "backgroundServicesPushMessaging";
  DevtoolsExperiments2[DevtoolsExperiments2["inputEventsOnTimelineOverview"] = 10] = "inputEventsOnTimelineOverview";
  DevtoolsExperiments2[DevtoolsExperiments2["liveHeapProfile"] = 11] = "liveHeapProfile";
  DevtoolsExperiments2[DevtoolsExperiments2["protocolMonitor"] = 13] = "protocolMonitor";
  DevtoolsExperiments2[DevtoolsExperiments2["developerResourcesView"] = 15] = "developerResourcesView";
  DevtoolsExperiments2[DevtoolsExperiments2["recordCoverageWithPerformanceTracing"] = 16] = "recordCoverageWithPerformanceTracing";
  DevtoolsExperiments2[DevtoolsExperiments2["samplingHeapProfilerTimeline"] = 17] = "samplingHeapProfilerTimeline";
  DevtoolsExperiments2[DevtoolsExperiments2["showOptionToExposeInternalsInHeapSnapshot"] = 18] = "showOptionToExposeInternalsInHeapSnapshot";
  DevtoolsExperiments2[DevtoolsExperiments2["sourceOrderViewer"] = 20] = "sourceOrderViewer";
  DevtoolsExperiments2[DevtoolsExperiments2["webauthnPane"] = 22] = "webauthnPane";
  DevtoolsExperiments2[DevtoolsExperiments2["timelineEventInitiators"] = 24] = "timelineEventInitiators";
  DevtoolsExperiments2[DevtoolsExperiments2["timelineInvalidationTracking"] = 26] = "timelineInvalidationTracking";
  DevtoolsExperiments2[DevtoolsExperiments2["timelineShowAllEvents"] = 27] = "timelineShowAllEvents";
  DevtoolsExperiments2[DevtoolsExperiments2["timelineV8RuntimeCallStats"] = 28] = "timelineV8RuntimeCallStats";
  DevtoolsExperiments2[DevtoolsExperiments2["timelineWebGL"] = 29] = "timelineWebGL";
  DevtoolsExperiments2[DevtoolsExperiments2["timelineReplayEvent"] = 30] = "timelineReplayEvent";
  DevtoolsExperiments2[DevtoolsExperiments2["wasmDWARFDebugging"] = 31] = "wasmDWARFDebugging";
  DevtoolsExperiments2[DevtoolsExperiments2["dualScreenSupport"] = 32] = "dualScreenSupport";
  DevtoolsExperiments2[DevtoolsExperiments2["keyboardShortcutEditor"] = 35] = "keyboardShortcutEditor";
  DevtoolsExperiments2[DevtoolsExperiments2["APCA"] = 39] = "APCA";
  DevtoolsExperiments2[DevtoolsExperiments2["cspViolationsView"] = 40] = "cspViolationsView";
  DevtoolsExperiments2[DevtoolsExperiments2["fontEditor"] = 41] = "fontEditor";
  DevtoolsExperiments2[DevtoolsExperiments2["fullAccessibilityTree"] = 42] = "fullAccessibilityTree";
  DevtoolsExperiments2[DevtoolsExperiments2["ignoreListJSFramesOnTimeline"] = 43] = "ignoreListJSFramesOnTimeline";
  DevtoolsExperiments2[DevtoolsExperiments2["contrastIssues"] = 44] = "contrastIssues";
  DevtoolsExperiments2[DevtoolsExperiments2["experimentalCookieFeatures"] = 45] = "experimentalCookieFeatures";
  DevtoolsExperiments2[DevtoolsExperiments2["hideIssuesFeature"] = 48] = "hideIssuesFeature";
  DevtoolsExperiments2[DevtoolsExperiments2["reportingApiDebugging"] = 49] = "reportingApiDebugging";
  DevtoolsExperiments2[DevtoolsExperiments2["syncSettings"] = 50] = "syncSettings";
  DevtoolsExperiments2[DevtoolsExperiments2["groupAndHideIssuesByKind"] = 51] = "groupAndHideIssuesByKind";
  DevtoolsExperiments2[DevtoolsExperiments2["cssTypeComponentLength"] = 52] = "cssTypeComponentLength";
  DevtoolsExperiments2[DevtoolsExperiments2["preciseChanges"] = 53] = "preciseChanges";
  DevtoolsExperiments2[DevtoolsExperiments2["bfcacheDisplayTree"] = 54] = "bfcacheDisplayTree";
  DevtoolsExperiments2[DevtoolsExperiments2["stylesPaneCSSChanges"] = 55] = "stylesPaneCSSChanges";
  DevtoolsExperiments2[DevtoolsExperiments2["headerOverrides"] = 56] = "headerOverrides";
  DevtoolsExperiments2[DevtoolsExperiments2["lighthousePanelFR"] = 57] = "lighthousePanelFR";
  DevtoolsExperiments2[DevtoolsExperiments2["evaluateExpressionsWithSourceMaps"] = 58] = "evaluateExpressionsWithSourceMaps";
  DevtoolsExperiments2[DevtoolsExperiments2["cssLayers"] = 59] = "cssLayers";
  DevtoolsExperiments2[DevtoolsExperiments2["eyedropperColorPicker"] = 60] = "eyedropperColorPicker";
  DevtoolsExperiments2[DevtoolsExperiments2["instrumentationBreakpoints"] = 61] = "instrumentationBreakpoints";
  DevtoolsExperiments2[DevtoolsExperiments2["cssAuthoringHints"] = 62] = "cssAuthoringHints";
  DevtoolsExperiments2[DevtoolsExperiments2["authoredDeployedGrouping"] = 63] = "authoredDeployedGrouping";
  DevtoolsExperiments2[DevtoolsExperiments2["MaxValue"] = 64] = "MaxValue";
  return DevtoolsExperiments2;
})(DevtoolsExperiments || {});
export var IssueExpanded = /* @__PURE__ */ ((IssueExpanded2) => {
  IssueExpanded2[IssueExpanded2["CrossOriginEmbedderPolicy"] = 0] = "CrossOriginEmbedderPolicy";
  IssueExpanded2[IssueExpanded2["MixedContent"] = 1] = "MixedContent";
  IssueExpanded2[IssueExpanded2["Cookie"] = 2] = "Cookie";
  IssueExpanded2[IssueExpanded2["HeavyAd"] = 3] = "HeavyAd";
  IssueExpanded2[IssueExpanded2["ContentSecurityPolicy"] = 4] = "ContentSecurityPolicy";
  IssueExpanded2[IssueExpanded2["Other"] = 5] = "Other";
  IssueExpanded2[IssueExpanded2["MaxValue"] = 6] = "MaxValue";
  return IssueExpanded2;
})(IssueExpanded || {});
export var IssueResourceOpened = /* @__PURE__ */ ((IssueResourceOpened2) => {
  IssueResourceOpened2[IssueResourceOpened2["CrossOriginEmbedderPolicyRequest"] = 0] = "CrossOriginEmbedderPolicyRequest";
  IssueResourceOpened2[IssueResourceOpened2["CrossOriginEmbedderPolicyElement"] = 1] = "CrossOriginEmbedderPolicyElement";
  IssueResourceOpened2[IssueResourceOpened2["MixedContentRequest"] = 2] = "MixedContentRequest";
  IssueResourceOpened2[IssueResourceOpened2["SameSiteCookieCookie"] = 3] = "SameSiteCookieCookie";
  IssueResourceOpened2[IssueResourceOpened2["SameSiteCookieRequest"] = 4] = "SameSiteCookieRequest";
  IssueResourceOpened2[IssueResourceOpened2["HeavyAdElement"] = 5] = "HeavyAdElement";
  IssueResourceOpened2[IssueResourceOpened2["ContentSecurityPolicyDirective"] = 6] = "ContentSecurityPolicyDirective";
  IssueResourceOpened2[IssueResourceOpened2["ContentSecurityPolicyElement"] = 7] = "ContentSecurityPolicyElement";
  IssueResourceOpened2[IssueResourceOpened2["CrossOriginEmbedderPolicyLearnMore"] = 8] = "CrossOriginEmbedderPolicyLearnMore";
  IssueResourceOpened2[IssueResourceOpened2["MixedContentLearnMore"] = 9] = "MixedContentLearnMore";
  IssueResourceOpened2[IssueResourceOpened2["SameSiteCookieLearnMore"] = 10] = "SameSiteCookieLearnMore";
  IssueResourceOpened2[IssueResourceOpened2["HeavyAdLearnMore"] = 11] = "HeavyAdLearnMore";
  IssueResourceOpened2[IssueResourceOpened2["ContentSecurityPolicyLearnMore"] = 12] = "ContentSecurityPolicyLearnMore";
  IssueResourceOpened2[IssueResourceOpened2["MaxValue"] = 13] = "MaxValue";
  return IssueResourceOpened2;
})(IssueResourceOpened || {});
export var IssueCreated = /* @__PURE__ */ ((IssueCreated2) => {
  IssueCreated2[IssueCreated2["MixedContentIssue"] = 0] = "MixedContentIssue";
  IssueCreated2[IssueCreated2["ContentSecurityPolicyIssue::kInlineViolation"] = 1] = "ContentSecurityPolicyIssue::kInlineViolation";
  IssueCreated2[IssueCreated2["ContentSecurityPolicyIssue::kEvalViolation"] = 2] = "ContentSecurityPolicyIssue::kEvalViolation";
  IssueCreated2[IssueCreated2["ContentSecurityPolicyIssue::kURLViolation"] = 3] = "ContentSecurityPolicyIssue::kURLViolation";
  IssueCreated2[IssueCreated2["ContentSecurityPolicyIssue::kTrustedTypesSinkViolation"] = 4] = "ContentSecurityPolicyIssue::kTrustedTypesSinkViolation";
  IssueCreated2[IssueCreated2["ContentSecurityPolicyIssue::kTrustedTypesPolicyViolation"] = 5] = "ContentSecurityPolicyIssue::kTrustedTypesPolicyViolation";
  IssueCreated2[IssueCreated2["HeavyAdIssue::NetworkTotalLimit"] = 6] = "HeavyAdIssue::NetworkTotalLimit";
  IssueCreated2[IssueCreated2["HeavyAdIssue::CpuTotalLimit"] = 7] = "HeavyAdIssue::CpuTotalLimit";
  IssueCreated2[IssueCreated2["HeavyAdIssue::CpuPeakLimit"] = 8] = "HeavyAdIssue::CpuPeakLimit";
  IssueCreated2[IssueCreated2["CrossOriginEmbedderPolicyIssue::CoepFrameResourceNeedsCoepHeader"] = 9] = "CrossOriginEmbedderPolicyIssue::CoepFrameResourceNeedsCoepHeader";
  IssueCreated2[IssueCreated2["CrossOriginEmbedderPolicyIssue::CoopSandboxedIFrameCannotNavigateToCoopPage"] = 10] = "CrossOriginEmbedderPolicyIssue::CoopSandboxedIFrameCannotNavigateToCoopPage";
  IssueCreated2[IssueCreated2["CrossOriginEmbedderPolicyIssue::CorpNotSameOrigin"] = 11] = "CrossOriginEmbedderPolicyIssue::CorpNotSameOrigin";
  IssueCreated2[IssueCreated2["CrossOriginEmbedderPolicyIssue::CorpNotSameOriginAfterDefaultedToSameOriginByCoep"] = 12] = "CrossOriginEmbedderPolicyIssue::CorpNotSameOriginAfterDefaultedToSameOriginByCoep";
  IssueCreated2[IssueCreated2["CrossOriginEmbedderPolicyIssue::CorpNotSameSite"] = 13] = "CrossOriginEmbedderPolicyIssue::CorpNotSameSite";
  IssueCreated2[IssueCreated2["CookieIssue::ExcludeSameSiteNoneInsecure::ReadCookie"] = 14] = "CookieIssue::ExcludeSameSiteNoneInsecure::ReadCookie";
  IssueCreated2[IssueCreated2["CookieIssue::ExcludeSameSiteNoneInsecure::SetCookie"] = 15] = "CookieIssue::ExcludeSameSiteNoneInsecure::SetCookie";
  IssueCreated2[IssueCreated2["CookieIssue::WarnSameSiteNoneInsecure::ReadCookie"] = 16] = "CookieIssue::WarnSameSiteNoneInsecure::ReadCookie";
  IssueCreated2[IssueCreated2["CookieIssue::WarnSameSiteNoneInsecure::SetCookie"] = 17] = "CookieIssue::WarnSameSiteNoneInsecure::SetCookie";
  IssueCreated2[IssueCreated2["CookieIssue::WarnSameSiteStrictLaxDowngradeStrict::Secure"] = 18] = "CookieIssue::WarnSameSiteStrictLaxDowngradeStrict::Secure";
  IssueCreated2[IssueCreated2["CookieIssue::WarnSameSiteStrictLaxDowngradeStrict::Insecure"] = 19] = "CookieIssue::WarnSameSiteStrictLaxDowngradeStrict::Insecure";
  IssueCreated2[IssueCreated2["CookieIssue::WarnCrossDowngrade::ReadCookie::Secure"] = 20] = "CookieIssue::WarnCrossDowngrade::ReadCookie::Secure";
  IssueCreated2[IssueCreated2["CookieIssue::WarnCrossDowngrade::ReadCookie::Insecure"] = 21] = "CookieIssue::WarnCrossDowngrade::ReadCookie::Insecure";
  IssueCreated2[IssueCreated2["CookieIssue::WarnCrossDowngrade::SetCookie::Secure"] = 22] = "CookieIssue::WarnCrossDowngrade::SetCookie::Secure";
  IssueCreated2[IssueCreated2["CookieIssue::WarnCrossDowngrade::SetCookie::Insecure"] = 23] = "CookieIssue::WarnCrossDowngrade::SetCookie::Insecure";
  IssueCreated2[IssueCreated2["CookieIssue::ExcludeNavigationContextDowngrade::Secure"] = 24] = "CookieIssue::ExcludeNavigationContextDowngrade::Secure";
  IssueCreated2[IssueCreated2["CookieIssue::ExcludeNavigationContextDowngrade::Insecure"] = 25] = "CookieIssue::ExcludeNavigationContextDowngrade::Insecure";
  IssueCreated2[IssueCreated2["CookieIssue::ExcludeContextDowngrade::ReadCookie::Secure"] = 26] = "CookieIssue::ExcludeContextDowngrade::ReadCookie::Secure";
  IssueCreated2[IssueCreated2["CookieIssue::ExcludeContextDowngrade::ReadCookie::Insecure"] = 27] = "CookieIssue::ExcludeContextDowngrade::ReadCookie::Insecure";
  IssueCreated2[IssueCreated2["CookieIssue::ExcludeContextDowngrade::SetCookie::Secure"] = 28] = "CookieIssue::ExcludeContextDowngrade::SetCookie::Secure";
  IssueCreated2[IssueCreated2["CookieIssue::ExcludeContextDowngrade::SetCookie::Insecure"] = 29] = "CookieIssue::ExcludeContextDowngrade::SetCookie::Insecure";
  IssueCreated2[IssueCreated2["CookieIssue::ExcludeSameSiteUnspecifiedTreatedAsLax::ReadCookie"] = 30] = "CookieIssue::ExcludeSameSiteUnspecifiedTreatedAsLax::ReadCookie";
  IssueCreated2[IssueCreated2["CookieIssue::ExcludeSameSiteUnspecifiedTreatedAsLax::SetCookie"] = 31] = "CookieIssue::ExcludeSameSiteUnspecifiedTreatedAsLax::SetCookie";
  IssueCreated2[IssueCreated2["CookieIssue::WarnSameSiteUnspecifiedLaxAllowUnsafe::ReadCookie"] = 32] = "CookieIssue::WarnSameSiteUnspecifiedLaxAllowUnsafe::ReadCookie";
  IssueCreated2[IssueCreated2["CookieIssue::WarnSameSiteUnspecifiedLaxAllowUnsafe::SetCookie"] = 33] = "CookieIssue::WarnSameSiteUnspecifiedLaxAllowUnsafe::SetCookie";
  IssueCreated2[IssueCreated2["CookieIssue::WarnSameSiteUnspecifiedCrossSiteContext::ReadCookie"] = 34] = "CookieIssue::WarnSameSiteUnspecifiedCrossSiteContext::ReadCookie";
  IssueCreated2[IssueCreated2["CookieIssue::WarnSameSiteUnspecifiedCrossSiteContext::SetCookie"] = 35] = "CookieIssue::WarnSameSiteUnspecifiedCrossSiteContext::SetCookie";
  IssueCreated2[IssueCreated2["SharedArrayBufferIssue::TransferIssue"] = 36] = "SharedArrayBufferIssue::TransferIssue";
  IssueCreated2[IssueCreated2["SharedArrayBufferIssue::CreationIssue"] = 37] = "SharedArrayBufferIssue::CreationIssue";
  IssueCreated2[IssueCreated2["TrustedWebActivityIssue::kHttpError"] = 38] = "TrustedWebActivityIssue::kHttpError";
  IssueCreated2[IssueCreated2["TrustedWebActivityIssue::kUnavailableOffline"] = 39] = "TrustedWebActivityIssue::kUnavailableOffline";
  IssueCreated2[IssueCreated2["TrustedWebActivityIssue::kDigitalAssetLinks"] = 40] = "TrustedWebActivityIssue::kDigitalAssetLinks";
  IssueCreated2[IssueCreated2["LowTextContrastIssue"] = 41] = "LowTextContrastIssue";
  IssueCreated2[IssueCreated2["CorsIssue::InsecurePrivateNetwork"] = 42] = "CorsIssue::InsecurePrivateNetwork";
  IssueCreated2[IssueCreated2["CorsIssue::InvalidHeaders"] = 44] = "CorsIssue::InvalidHeaders";
  IssueCreated2[IssueCreated2["CorsIssue::WildcardOriginWithCredentials"] = 45] = "CorsIssue::WildcardOriginWithCredentials";
  IssueCreated2[IssueCreated2["CorsIssue::PreflightResponseInvalid"] = 46] = "CorsIssue::PreflightResponseInvalid";
  IssueCreated2[IssueCreated2["CorsIssue::OriginMismatch"] = 47] = "CorsIssue::OriginMismatch";
  IssueCreated2[IssueCreated2["CorsIssue::AllowCredentialsRequired"] = 48] = "CorsIssue::AllowCredentialsRequired";
  IssueCreated2[IssueCreated2["CorsIssue::MethodDisallowedByPreflightResponse"] = 49] = "CorsIssue::MethodDisallowedByPreflightResponse";
  IssueCreated2[IssueCreated2["CorsIssue::HeaderDisallowedByPreflightResponse"] = 50] = "CorsIssue::HeaderDisallowedByPreflightResponse";
  IssueCreated2[IssueCreated2["CorsIssue::RedirectContainsCredentials"] = 51] = "CorsIssue::RedirectContainsCredentials";
  IssueCreated2[IssueCreated2["CorsIssue::DisallowedByMode"] = 52] = "CorsIssue::DisallowedByMode";
  IssueCreated2[IssueCreated2["CorsIssue::CorsDisabledScheme"] = 53] = "CorsIssue::CorsDisabledScheme";
  IssueCreated2[IssueCreated2["CorsIssue::PreflightMissingAllowExternal"] = 54] = "CorsIssue::PreflightMissingAllowExternal";
  IssueCreated2[IssueCreated2["CorsIssue::PreflightInvalidAllowExternal"] = 55] = "CorsIssue::PreflightInvalidAllowExternal";
  IssueCreated2[IssueCreated2["CorsIssue::NoCorsRedirectModeNotFollow"] = 57] = "CorsIssue::NoCorsRedirectModeNotFollow";
  IssueCreated2[IssueCreated2["QuirksModeIssue::QuirksMode"] = 58] = "QuirksModeIssue::QuirksMode";
  IssueCreated2[IssueCreated2["QuirksModeIssue::LimitedQuirksMode"] = 59] = "QuirksModeIssue::LimitedQuirksMode";
  IssueCreated2[IssueCreated2["DeprecationIssue"] = 60] = "DeprecationIssue";
  IssueCreated2[IssueCreated2["ClientHintIssue::MetaTagAllowListInvalidOrigin"] = 61] = "ClientHintIssue::MetaTagAllowListInvalidOrigin";
  IssueCreated2[IssueCreated2["ClientHintIssue::MetaTagModifiedHTML"] = 62] = "ClientHintIssue::MetaTagModifiedHTML";
  IssueCreated2[IssueCreated2["CorsIssue::PreflightAllowPrivateNetworkError"] = 63] = "CorsIssue::PreflightAllowPrivateNetworkError";
  IssueCreated2[IssueCreated2["MaxValue"] = 64] = "MaxValue";
  return IssueCreated2;
})(IssueCreated || {});
export var DeveloperResourceLoaded = /* @__PURE__ */ ((DeveloperResourceLoaded2) => {
  DeveloperResourceLoaded2[DeveloperResourceLoaded2["LoadThroughPageViaTarget"] = 0] = "LoadThroughPageViaTarget";
  DeveloperResourceLoaded2[DeveloperResourceLoaded2["LoadThroughPageViaFrame"] = 1] = "LoadThroughPageViaFrame";
  DeveloperResourceLoaded2[DeveloperResourceLoaded2["LoadThroughPageFailure"] = 2] = "LoadThroughPageFailure";
  DeveloperResourceLoaded2[DeveloperResourceLoaded2["LoadThroughPageFallback"] = 3] = "LoadThroughPageFallback";
  DeveloperResourceLoaded2[DeveloperResourceLoaded2["FallbackAfterFailure"] = 4] = "FallbackAfterFailure";
  DeveloperResourceLoaded2[DeveloperResourceLoaded2["FallbackPerOverride"] = 5] = "FallbackPerOverride";
  DeveloperResourceLoaded2[DeveloperResourceLoaded2["FallbackPerProtocol"] = 6] = "FallbackPerProtocol";
  DeveloperResourceLoaded2[DeveloperResourceLoaded2["FallbackFailure"] = 7] = "FallbackFailure";
  DeveloperResourceLoaded2[DeveloperResourceLoaded2["MaxValue"] = 8] = "MaxValue";
  return DeveloperResourceLoaded2;
})(DeveloperResourceLoaded || {});
export var DeveloperResourceScheme = /* @__PURE__ */ ((DeveloperResourceScheme2) => {
  DeveloperResourceScheme2[DeveloperResourceScheme2["SchemeOther"] = 0] = "SchemeOther";
  DeveloperResourceScheme2[DeveloperResourceScheme2["SchemeUnknown"] = 1] = "SchemeUnknown";
  DeveloperResourceScheme2[DeveloperResourceScheme2["SchemeHttp"] = 2] = "SchemeHttp";
  DeveloperResourceScheme2[DeveloperResourceScheme2["SchemeHttps"] = 3] = "SchemeHttps";
  DeveloperResourceScheme2[DeveloperResourceScheme2["SchemeHttpLocalhost"] = 4] = "SchemeHttpLocalhost";
  DeveloperResourceScheme2[DeveloperResourceScheme2["SchemeHttpsLocalhost"] = 5] = "SchemeHttpsLocalhost";
  DeveloperResourceScheme2[DeveloperResourceScheme2["SchemeData"] = 6] = "SchemeData";
  DeveloperResourceScheme2[DeveloperResourceScheme2["SchemeFile"] = 7] = "SchemeFile";
  DeveloperResourceScheme2[DeveloperResourceScheme2["SchemeBlob"] = 8] = "SchemeBlob";
  DeveloperResourceScheme2[DeveloperResourceScheme2["MaxValue"] = 9] = "MaxValue";
  return DeveloperResourceScheme2;
})(DeveloperResourceScheme || {});
export var LinearMemoryInspectorRevealedFrom = /* @__PURE__ */ ((LinearMemoryInspectorRevealedFrom2) => {
  LinearMemoryInspectorRevealedFrom2[LinearMemoryInspectorRevealedFrom2["ContextMenu"] = 0] = "ContextMenu";
  LinearMemoryInspectorRevealedFrom2[LinearMemoryInspectorRevealedFrom2["MemoryIcon"] = 1] = "MemoryIcon";
  LinearMemoryInspectorRevealedFrom2[LinearMemoryInspectorRevealedFrom2["MaxValue"] = 2] = "MaxValue";
  return LinearMemoryInspectorRevealedFrom2;
})(LinearMemoryInspectorRevealedFrom || {});
export var LinearMemoryInspectorTarget = /* @__PURE__ */ ((LinearMemoryInspectorTarget2) => {
  LinearMemoryInspectorTarget2[LinearMemoryInspectorTarget2["DWARFInspectableAddress"] = 0] = "DWARFInspectableAddress";
  LinearMemoryInspectorTarget2[LinearMemoryInspectorTarget2["ArrayBuffer"] = 1] = "ArrayBuffer";
  LinearMemoryInspectorTarget2[LinearMemoryInspectorTarget2["DataView"] = 2] = "DataView";
  LinearMemoryInspectorTarget2[LinearMemoryInspectorTarget2["TypedArray"] = 3] = "TypedArray";
  LinearMemoryInspectorTarget2[LinearMemoryInspectorTarget2["WebAssemblyMemory"] = 4] = "WebAssemblyMemory";
  LinearMemoryInspectorTarget2[LinearMemoryInspectorTarget2["MaxValue"] = 5] = "MaxValue";
  return LinearMemoryInspectorTarget2;
})(LinearMemoryInspectorTarget || {});
export var Language = /* @__PURE__ */ ((Language2) => {
  Language2[Language2["af"] = 1] = "af";
  Language2[Language2["am"] = 2] = "am";
  Language2[Language2["ar"] = 3] = "ar";
  Language2[Language2["as"] = 4] = "as";
  Language2[Language2["az"] = 5] = "az";
  Language2[Language2["be"] = 6] = "be";
  Language2[Language2["bg"] = 7] = "bg";
  Language2[Language2["bn"] = 8] = "bn";
  Language2[Language2["bs"] = 9] = "bs";
  Language2[Language2["ca"] = 10] = "ca";
  Language2[Language2["cs"] = 11] = "cs";
  Language2[Language2["cy"] = 12] = "cy";
  Language2[Language2["da"] = 13] = "da";
  Language2[Language2["de"] = 14] = "de";
  Language2[Language2["el"] = 15] = "el";
  Language2[Language2["en-GB"] = 16] = "en-GB";
  Language2[Language2["en-US"] = 17] = "en-US";
  Language2[Language2["es-419"] = 18] = "es-419";
  Language2[Language2["es"] = 19] = "es";
  Language2[Language2["et"] = 20] = "et";
  Language2[Language2["eu"] = 21] = "eu";
  Language2[Language2["fa"] = 22] = "fa";
  Language2[Language2["fi"] = 23] = "fi";
  Language2[Language2["fil"] = 24] = "fil";
  Language2[Language2["fr-CA"] = 25] = "fr-CA";
  Language2[Language2["fr"] = 26] = "fr";
  Language2[Language2["gl"] = 27] = "gl";
  Language2[Language2["gu"] = 28] = "gu";
  Language2[Language2["he"] = 29] = "he";
  Language2[Language2["hi"] = 30] = "hi";
  Language2[Language2["hr"] = 31] = "hr";
  Language2[Language2["hu"] = 32] = "hu";
  Language2[Language2["hy"] = 33] = "hy";
  Language2[Language2["id"] = 34] = "id";
  Language2[Language2["is"] = 35] = "is";
  Language2[Language2["it"] = 36] = "it";
  Language2[Language2["ja"] = 37] = "ja";
  Language2[Language2["ka"] = 38] = "ka";
  Language2[Language2["kk"] = 39] = "kk";
  Language2[Language2["km"] = 40] = "km";
  Language2[Language2["kn"] = 41] = "kn";
  Language2[Language2["ko"] = 42] = "ko";
  Language2[Language2["ky"] = 43] = "ky";
  Language2[Language2["lo"] = 44] = "lo";
  Language2[Language2["lt"] = 45] = "lt";
  Language2[Language2["lv"] = 46] = "lv";
  Language2[Language2["mk"] = 47] = "mk";
  Language2[Language2["ml"] = 48] = "ml";
  Language2[Language2["mn"] = 49] = "mn";
  Language2[Language2["mr"] = 50] = "mr";
  Language2[Language2["ms"] = 51] = "ms";
  Language2[Language2["my"] = 52] = "my";
  Language2[Language2["ne"] = 53] = "ne";
  Language2[Language2["nl"] = 54] = "nl";
  Language2[Language2["no"] = 55] = "no";
  Language2[Language2["or"] = 56] = "or";
  Language2[Language2["pa"] = 57] = "pa";
  Language2[Language2["pl"] = 58] = "pl";
  Language2[Language2["pt-PT"] = 59] = "pt-PT";
  Language2[Language2["pt"] = 60] = "pt";
  Language2[Language2["ro"] = 61] = "ro";
  Language2[Language2["ru"] = 62] = "ru";
  Language2[Language2["si"] = 63] = "si";
  Language2[Language2["sk"] = 64] = "sk";
  Language2[Language2["sl"] = 65] = "sl";
  Language2[Language2["sq"] = 66] = "sq";
  Language2[Language2["sr-Latn"] = 67] = "sr-Latn";
  Language2[Language2["sr"] = 68] = "sr";
  Language2[Language2["sv"] = 69] = "sv";
  Language2[Language2["sw"] = 70] = "sw";
  Language2[Language2["ta"] = 71] = "ta";
  Language2[Language2["te"] = 72] = "te";
  Language2[Language2["th"] = 73] = "th";
  Language2[Language2["tr"] = 74] = "tr";
  Language2[Language2["uk"] = 75] = "uk";
  Language2[Language2["ur"] = 76] = "ur";
  Language2[Language2["uz"] = 77] = "uz";
  Language2[Language2["vi"] = 78] = "vi";
  Language2[Language2["zh"] = 79] = "zh";
  Language2[Language2["zh-HK"] = 80] = "zh-HK";
  Language2[Language2["zh-TW"] = 81] = "zh-TW";
  Language2[Language2["zu"] = 82] = "zu";
  Language2[Language2["MaxValue"] = 83] = "MaxValue";
  return Language2;
})(Language || {});
export var SyncSetting = /* @__PURE__ */ ((SyncSetting2) => {
  SyncSetting2[SyncSetting2["ChromeSyncDisabled"] = 1] = "ChromeSyncDisabled";
  SyncSetting2[SyncSetting2["ChromeSyncSettingsDisabled"] = 2] = "ChromeSyncSettingsDisabled";
  SyncSetting2[SyncSetting2["DevToolsSyncSettingDisabled"] = 3] = "DevToolsSyncSettingDisabled";
  SyncSetting2[SyncSetting2["DevToolsSyncSettingEnabled"] = 4] = "DevToolsSyncSettingEnabled";
  SyncSetting2[SyncSetting2["MaxValue"] = 5] = "MaxValue";
  return SyncSetting2;
})(SyncSetting || {});
export var RecordingToggled = /* @__PURE__ */ ((RecordingToggled2) => {
  RecordingToggled2[RecordingToggled2["RecordingStarted"] = 1] = "RecordingStarted";
  RecordingToggled2[RecordingToggled2["RecordingFinished"] = 2] = "RecordingFinished";
  RecordingToggled2[RecordingToggled2["MaxValue"] = 3] = "MaxValue";
  return RecordingToggled2;
})(RecordingToggled || {});
export var RecordingReplayFinished = /* @__PURE__ */ ((RecordingReplayFinished2) => {
  RecordingReplayFinished2[RecordingReplayFinished2["Success"] = 1] = "Success";
  RecordingReplayFinished2[RecordingReplayFinished2["TimeoutErrorSelectors"] = 2] = "TimeoutErrorSelectors";
  RecordingReplayFinished2[RecordingReplayFinished2["TimeoutErrorTarget"] = 3] = "TimeoutErrorTarget";
  RecordingReplayFinished2[RecordingReplayFinished2["OtherError"] = 4] = "OtherError";
  RecordingReplayFinished2[RecordingReplayFinished2["MaxValue"] = 5] = "MaxValue";
  return RecordingReplayFinished2;
})(RecordingReplayFinished || {});
export var RecordingReplaySpeed = /* @__PURE__ */ ((RecordingReplaySpeed2) => {
  RecordingReplaySpeed2[RecordingReplaySpeed2["Normal"] = 1] = "Normal";
  RecordingReplaySpeed2[RecordingReplaySpeed2["Slow"] = 2] = "Slow";
  RecordingReplaySpeed2[RecordingReplaySpeed2["VerySlow"] = 3] = "VerySlow";
  RecordingReplaySpeed2[RecordingReplaySpeed2["ExtremelySlow"] = 4] = "ExtremelySlow";
  RecordingReplaySpeed2[RecordingReplaySpeed2["MaxValue"] = 5] = "MaxValue";
  return RecordingReplaySpeed2;
})(RecordingReplaySpeed || {});
export var RecordingReplayStarted = /* @__PURE__ */ ((RecordingReplayStarted2) => {
  RecordingReplayStarted2[RecordingReplayStarted2["ReplayOnly"] = 1] = "ReplayOnly";
  RecordingReplayStarted2[RecordingReplayStarted2["ReplayWithPerformanceTracing"] = 2] = "ReplayWithPerformanceTracing";
  RecordingReplayStarted2[RecordingReplayStarted2["MaxValue"] = 3] = "MaxValue";
  return RecordingReplayStarted2;
})(RecordingReplayStarted || {});
export var RecordingEdited = /* @__PURE__ */ ((RecordingEdited2) => {
  RecordingEdited2[RecordingEdited2["SelectorPickerUsed"] = 1] = "SelectorPickerUsed";
  RecordingEdited2[RecordingEdited2["StepAdded"] = 2] = "StepAdded";
  RecordingEdited2[RecordingEdited2["StepRemoved"] = 3] = "StepRemoved";
  RecordingEdited2[RecordingEdited2["SelectorAdded"] = 4] = "SelectorAdded";
  RecordingEdited2[RecordingEdited2["SelectorRemoved"] = 5] = "SelectorRemoved";
  RecordingEdited2[RecordingEdited2["SelectorPartAdded"] = 6] = "SelectorPartAdded";
  RecordingEdited2[RecordingEdited2["SelectorPartEdited"] = 7] = "SelectorPartEdited";
  RecordingEdited2[RecordingEdited2["SelectorPartRemoved"] = 8] = "SelectorPartRemoved";
  RecordingEdited2[RecordingEdited2["TypeChanged"] = 9] = "TypeChanged";
  RecordingEdited2[RecordingEdited2["OtherEditing"] = 10] = "OtherEditing";
  RecordingEdited2[RecordingEdited2["MaxValue"] = 11] = "MaxValue";
  return RecordingEdited2;
})(RecordingEdited || {});
export var RecordingExported = /* @__PURE__ */ ((RecordingExported2) => {
  RecordingExported2[RecordingExported2["ToPuppeteer"] = 1] = "ToPuppeteer";
  RecordingExported2[RecordingExported2["ToJSON"] = 2] = "ToJSON";
  RecordingExported2[RecordingExported2["ToPuppeteerReplay"] = 3] = "ToPuppeteerReplay";
  RecordingExported2[RecordingExported2["ToExtension"] = 4] = "ToExtension";
  RecordingExported2[RecordingExported2["MaxValue"] = 5] = "MaxValue";
  return RecordingExported2;
})(RecordingExported || {});
export var ConsoleShowsCorsErrors = /* @__PURE__ */ ((ConsoleShowsCorsErrors2) => {
  ConsoleShowsCorsErrors2[ConsoleShowsCorsErrors2["false"] = 0] = "false";
  ConsoleShowsCorsErrors2[ConsoleShowsCorsErrors2["true"] = 1] = "true";
  ConsoleShowsCorsErrors2[ConsoleShowsCorsErrors2["MaxValue"] = 2] = "MaxValue";
  return ConsoleShowsCorsErrors2;
})(ConsoleShowsCorsErrors || {});
export var StyleTextCopied = /* @__PURE__ */ ((StyleTextCopied2) => {
  StyleTextCopied2[StyleTextCopied2["DeclarationViaChangedLine"] = 1] = "DeclarationViaChangedLine";
  StyleTextCopied2[StyleTextCopied2["AllChangesViaStylesPane"] = 2] = "AllChangesViaStylesPane";
  StyleTextCopied2[StyleTextCopied2["DeclarationViaContextMenu"] = 3] = "DeclarationViaContextMenu";
  StyleTextCopied2[StyleTextCopied2["PropertyViaContextMenu"] = 4] = "PropertyViaContextMenu";
  StyleTextCopied2[StyleTextCopied2["ValueViaContextMenu"] = 5] = "ValueViaContextMenu";
  StyleTextCopied2[StyleTextCopied2["DeclarationAsJSViaContextMenu"] = 6] = "DeclarationAsJSViaContextMenu";
  StyleTextCopied2[StyleTextCopied2["RuleViaContextMenu"] = 7] = "RuleViaContextMenu";
  StyleTextCopied2[StyleTextCopied2["AllDeclarationsViaContextMenu"] = 8] = "AllDeclarationsViaContextMenu";
  StyleTextCopied2[StyleTextCopied2["AllDeclarationsAsJSViaContextMenu"] = 9] = "AllDeclarationsAsJSViaContextMenu";
  StyleTextCopied2[StyleTextCopied2["SelectorViaContextMenu"] = 10] = "SelectorViaContextMenu";
  StyleTextCopied2[StyleTextCopied2["MaxValue"] = 11] = "MaxValue";
  return StyleTextCopied2;
})(StyleTextCopied || {});
//# sourceMappingURL=UserMetrics.js.map
