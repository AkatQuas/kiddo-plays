import * as WorkspaceDiffModule from "./workspace_diff.js";
self.WorkspaceDiff = self.WorkspaceDiff || {};
WorkspaceDiff = WorkspaceDiff || {};
WorkspaceDiff.WorkspaceDiff = WorkspaceDiffModule.WorkspaceDiff.WorkspaceDiffImpl;
WorkspaceDiff.WorkspaceDiff.UISourceCodeDiff = WorkspaceDiffModule.WorkspaceDiff.UISourceCodeDiff;
WorkspaceDiff.WorkspaceDiff.UpdateTimeout = WorkspaceDiffModule.WorkspaceDiff.UpdateTimeout;
WorkspaceDiff.Events = WorkspaceDiffModule.WorkspaceDiff.Events;
WorkspaceDiff.workspaceDiff = WorkspaceDiffModule.WorkspaceDiff.workspaceDiff;
WorkspaceDiff.DiffUILocation = WorkspaceDiffModule.WorkspaceDiff.DiffUILocation;
//# sourceMappingURL=workspace_diff-legacy.js.map
