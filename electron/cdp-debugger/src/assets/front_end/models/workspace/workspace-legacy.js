import * as WorkspaceModule from "./workspace.js";
self.Workspace = self.Workspace || {};
Workspace = Workspace || {};
Workspace.FileManager = WorkspaceModule.FileManager.FileManager;
Workspace.UISourceCode = WorkspaceModule.UISourceCode.UISourceCode;
Workspace.UISourceCode.Events = WorkspaceModule.UISourceCode.Events;
Workspace.UISourceCode.Message = WorkspaceModule.UISourceCode.Message;
Workspace.UISourceCode.Message.Level = WorkspaceModule.UISourceCode.Message.Level;
Workspace.UILocation = WorkspaceModule.UISourceCode.UILocation;
Workspace.UISourceCodeMetadata = WorkspaceModule.UISourceCode.UISourceCodeMetadata;
Workspace.Workspace = WorkspaceModule.Workspace.WorkspaceImpl;
Workspace.Workspace.Events = WorkspaceModule.Workspace.Events;
Workspace.Project = WorkspaceModule.Workspace.Project;
Workspace.projectTypes = WorkspaceModule.Workspace.projectTypes;
Workspace.ProjectStore = WorkspaceModule.Workspace.ProjectStore;
//# sourceMappingURL=workspace-legacy.js.map
