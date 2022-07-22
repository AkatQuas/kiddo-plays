export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["AppendedToURL"] = "appendedToURL";
  Events2["CanceledSaveURL"] = "canceledSaveURL";
  Events2["ContextMenuCleared"] = "contextMenuCleared";
  Events2["ContextMenuItemSelected"] = "contextMenuItemSelected";
  Events2["DeviceCountUpdated"] = "deviceCountUpdated";
  Events2["DevicesDiscoveryConfigChanged"] = "devicesDiscoveryConfigChanged";
  Events2["DevicesPortForwardingStatusChanged"] = "devicesPortForwardingStatusChanged";
  Events2["DevicesUpdated"] = "devicesUpdated";
  Events2["DispatchMessage"] = "dispatchMessage";
  Events2["DispatchMessageChunk"] = "dispatchMessageChunk";
  Events2["EnterInspectElementMode"] = "enterInspectElementMode";
  Events2["EyeDropperPickedColor"] = "eyeDropperPickedColor";
  Events2["FileSystemsLoaded"] = "fileSystemsLoaded";
  Events2["FileSystemRemoved"] = "fileSystemRemoved";
  Events2["FileSystemAdded"] = "fileSystemAdded";
  Events2["FileSystemFilesChangedAddedRemoved"] = "FileSystemFilesChangedAddedRemoved";
  Events2["IndexingTotalWorkCalculated"] = "indexingTotalWorkCalculated";
  Events2["IndexingWorked"] = "indexingWorked";
  Events2["IndexingDone"] = "indexingDone";
  Events2["KeyEventUnhandled"] = "keyEventUnhandled";
  Events2["ReattachMainTarget"] = "reattachMainTarget";
  Events2["ReloadInspectedPage"] = "reloadInspectedPage";
  Events2["RevealSourceLine"] = "revealSourceLine";
  Events2["SavedURL"] = "savedURL";
  Events2["SearchCompleted"] = "searchCompleted";
  Events2["SetInspectedTabId"] = "setInspectedTabId";
  Events2["SetUseSoftMenu"] = "setUseSoftMenu";
  Events2["ShowPanel"] = "showPanel";
  return Events2;
})(Events || {});
export const EventDescriptors = [
  ["appendedToURL" /* AppendedToURL */, "appendedToURL", ["url"]],
  ["canceledSaveURL" /* CanceledSaveURL */, "canceledSaveURL", ["url"]],
  ["contextMenuCleared" /* ContextMenuCleared */, "contextMenuCleared", []],
  ["contextMenuItemSelected" /* ContextMenuItemSelected */, "contextMenuItemSelected", ["id"]],
  ["deviceCountUpdated" /* DeviceCountUpdated */, "deviceCountUpdated", ["count"]],
  ["devicesDiscoveryConfigChanged" /* DevicesDiscoveryConfigChanged */, "devicesDiscoveryConfigChanged", ["config"]],
  ["devicesPortForwardingStatusChanged" /* DevicesPortForwardingStatusChanged */, "devicesPortForwardingStatusChanged", ["status"]],
  ["devicesUpdated" /* DevicesUpdated */, "devicesUpdated", ["devices"]],
  ["dispatchMessage" /* DispatchMessage */, "dispatchMessage", ["messageObject"]],
  ["dispatchMessageChunk" /* DispatchMessageChunk */, "dispatchMessageChunk", ["messageChunk", "messageSize"]],
  ["enterInspectElementMode" /* EnterInspectElementMode */, "enterInspectElementMode", []],
  ["eyeDropperPickedColor" /* EyeDropperPickedColor */, "eyeDropperPickedColor", ["color"]],
  ["fileSystemsLoaded" /* FileSystemsLoaded */, "fileSystemsLoaded", ["fileSystems"]],
  ["fileSystemRemoved" /* FileSystemRemoved */, "fileSystemRemoved", ["fileSystemPath"]],
  ["fileSystemAdded" /* FileSystemAdded */, "fileSystemAdded", ["errorMessage", "fileSystem"]],
  ["FileSystemFilesChangedAddedRemoved" /* FileSystemFilesChangedAddedRemoved */, "fileSystemFilesChangedAddedRemoved", ["changed", "added", "removed"]],
  ["indexingTotalWorkCalculated" /* IndexingTotalWorkCalculated */, "indexingTotalWorkCalculated", ["requestId", "fileSystemPath", "totalWork"]],
  ["indexingWorked" /* IndexingWorked */, "indexingWorked", ["requestId", "fileSystemPath", "worked"]],
  ["indexingDone" /* IndexingDone */, "indexingDone", ["requestId", "fileSystemPath"]],
  ["keyEventUnhandled" /* KeyEventUnhandled */, "keyEventUnhandled", ["event"]],
  ["reattachMainTarget" /* ReattachMainTarget */, "reattachMainTarget", []],
  ["reloadInspectedPage" /* ReloadInspectedPage */, "reloadInspectedPage", ["hard"]],
  ["revealSourceLine" /* RevealSourceLine */, "revealSourceLine", ["url", "lineNumber", "columnNumber"]],
  ["savedURL" /* SavedURL */, "savedURL", ["url", "fileSystemPath"]],
  ["searchCompleted" /* SearchCompleted */, "searchCompleted", ["requestId", "fileSystemPath", "files"]],
  ["setInspectedTabId" /* SetInspectedTabId */, "setInspectedTabId", ["tabId"]],
  ["setUseSoftMenu" /* SetUseSoftMenu */, "setUseSoftMenu", ["useSoftMenu"]],
  ["showPanel" /* ShowPanel */, "showPanel", ["panelName"]]
];
export var EnumeratedHistogram = /* @__PURE__ */ ((EnumeratedHistogram2) => {
  EnumeratedHistogram2["ActionTaken"] = "DevTools.ActionTaken";
  EnumeratedHistogram2["PanelClosed"] = "DevTools.PanelClosed";
  EnumeratedHistogram2["PanelShown"] = "DevTools.PanelShown";
  EnumeratedHistogram2["SidebarPaneShown"] = "DevTools.SidebarPaneShown";
  EnumeratedHistogram2["KeyboardShortcutFired"] = "DevTools.KeyboardShortcutFired";
  EnumeratedHistogram2["IssueCreated"] = "DevTools.IssueCreated";
  EnumeratedHistogram2["IssuesPanelIssueExpanded"] = "DevTools.IssuesPanelIssueExpanded";
  EnumeratedHistogram2["IssuesPanelOpenedFrom"] = "DevTools.IssuesPanelOpenedFrom";
  EnumeratedHistogram2["IssuesPanelResourceOpened"] = "DevTools.IssuesPanelResourceOpened";
  EnumeratedHistogram2["KeybindSetSettingChanged"] = "DevTools.KeybindSetSettingChanged";
  EnumeratedHistogram2["ExperimentEnabledAtLaunch"] = "DevTools.ExperimentEnabledAtLaunch";
  EnumeratedHistogram2["ExperimentEnabled"] = "DevTools.ExperimentEnabled";
  EnumeratedHistogram2["ExperimentDisabled"] = "DevTools.ExperimentDisabled";
  EnumeratedHistogram2["DeveloperResourceLoaded"] = "DevTools.DeveloperResourceLoaded";
  EnumeratedHistogram2["DeveloperResourceScheme"] = "DevTools.DeveloperResourceScheme";
  EnumeratedHistogram2["LinearMemoryInspectorRevealedFrom"] = "DevTools.LinearMemoryInspector.RevealedFrom";
  EnumeratedHistogram2["LinearMemoryInspectorTarget"] = "DevTools.LinearMemoryInspector.Target";
  EnumeratedHistogram2["Language"] = "DevTools.Language";
  EnumeratedHistogram2["ConsoleShowsCorsErrors"] = "DevTools.ConsoleShowsCorsErrors";
  EnumeratedHistogram2["SyncSetting"] = "DevTools.SyncSetting";
  EnumeratedHistogram2["RecordingEdited"] = "DevTools.RecordingEdited";
  EnumeratedHistogram2["RecordingExported"] = "DevTools.RecordingExported";
  EnumeratedHistogram2["RecordingReplayFinished"] = "DevTools.RecordingReplayFinished";
  EnumeratedHistogram2["RecordingReplaySpeed"] = "DevTools.RecordingReplaySpeed";
  EnumeratedHistogram2["RecordingReplayStarted"] = "DevTools.RecordingReplayStarted";
  EnumeratedHistogram2["RecordingToggled"] = "DevTools.RecordingToggled";
  EnumeratedHistogram2["StyleTextCopied"] = "DevTools.StyleTextCopied";
  return EnumeratedHistogram2;
})(EnumeratedHistogram || {});
//# sourceMappingURL=InspectorFrontendHostAPI.js.map
