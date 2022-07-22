import * as Common from "../../core/common/common.js";
import { UISourceCode } from "./UISourceCode.js";
export var projectTypes = /* @__PURE__ */ ((projectTypes2) => {
  projectTypes2["Debugger"] = "debugger";
  projectTypes2["Formatter"] = "formatter";
  projectTypes2["Network"] = "network";
  projectTypes2["FileSystem"] = "filesystem";
  projectTypes2["ContentScripts"] = "contentscripts";
  projectTypes2["Service"] = "service";
  return projectTypes2;
})(projectTypes || {});
export class ProjectStore {
  workspaceInternal;
  idInternal;
  typeInternal;
  displayNameInternal;
  uiSourceCodesMap;
  uiSourceCodesList;
  constructor(workspace, id, type, displayName) {
    this.workspaceInternal = workspace;
    this.idInternal = id;
    this.typeInternal = type;
    this.displayNameInternal = displayName;
    this.uiSourceCodesMap = /* @__PURE__ */ new Map();
    this.uiSourceCodesList = [];
  }
  id() {
    return this.idInternal;
  }
  type() {
    return this.typeInternal;
  }
  displayName() {
    return this.displayNameInternal;
  }
  workspace() {
    return this.workspaceInternal;
  }
  createUISourceCode(url, contentType) {
    return new UISourceCode(this, url, contentType);
  }
  addUISourceCode(uiSourceCode) {
    const url = uiSourceCode.url();
    if (this.uiSourceCodeForURL(url)) {
      return false;
    }
    this.uiSourceCodesMap.set(url, { uiSourceCode, index: this.uiSourceCodesList.length });
    this.uiSourceCodesList.push(uiSourceCode);
    this.workspaceInternal.dispatchEventToListeners(Events.UISourceCodeAdded, uiSourceCode);
    return true;
  }
  removeUISourceCode(url) {
    const uiSourceCode = this.uiSourceCodeForURL(url);
    if (!uiSourceCode) {
      return;
    }
    const entry = this.uiSourceCodesMap.get(url);
    if (!entry) {
      return;
    }
    const movedUISourceCode = this.uiSourceCodesList[this.uiSourceCodesList.length - 1];
    this.uiSourceCodesList[entry.index] = movedUISourceCode;
    const movedEntry = this.uiSourceCodesMap.get(movedUISourceCode.url());
    if (movedEntry) {
      movedEntry.index = entry.index;
    }
    this.uiSourceCodesList.splice(this.uiSourceCodesList.length - 1, 1);
    this.uiSourceCodesMap.delete(url);
    this.workspaceInternal.dispatchEventToListeners(Events.UISourceCodeRemoved, entry.uiSourceCode);
  }
  removeProject() {
    this.workspaceInternal.removeProject(this);
    this.uiSourceCodesMap = /* @__PURE__ */ new Map();
    this.uiSourceCodesList = [];
  }
  uiSourceCodeForURL(url) {
    const entry = this.uiSourceCodesMap.get(url);
    return entry ? entry.uiSourceCode : null;
  }
  uiSourceCodes() {
    return this.uiSourceCodesList;
  }
  renameUISourceCode(uiSourceCode, newName) {
    const oldPath = uiSourceCode.url();
    const newPath = uiSourceCode.parentURL() ? Common.ParsedURL.ParsedURL.urlFromParentUrlAndName(uiSourceCode.parentURL(), newName) : Common.ParsedURL.ParsedURL.preEncodeSpecialCharactersInPath(newName);
    const value = this.uiSourceCodesMap.get(oldPath);
    this.uiSourceCodesMap.set(newPath, value);
    this.uiSourceCodesMap.delete(oldPath);
  }
  rename(_uiSourceCode, _newName, _callback) {
  }
  excludeFolder(_path) {
  }
  deleteFile(_uiSourceCode) {
  }
  remove() {
  }
  indexContent(_progress) {
  }
}
let workspaceInstance;
export class WorkspaceImpl extends Common.ObjectWrapper.ObjectWrapper {
  projectsInternal;
  hasResourceContentTrackingExtensionsInternal;
  constructor() {
    super();
    this.projectsInternal = /* @__PURE__ */ new Map();
    this.hasResourceContentTrackingExtensionsInternal = false;
  }
  static instance(opts = { forceNew: null }) {
    const { forceNew } = opts;
    if (!workspaceInstance || forceNew) {
      workspaceInstance = new WorkspaceImpl();
    }
    return workspaceInstance;
  }
  static removeInstance() {
    workspaceInstance = void 0;
  }
  uiSourceCode(projectId, url) {
    const project = this.projectsInternal.get(projectId);
    return project ? project.uiSourceCodeForURL(url) : null;
  }
  uiSourceCodeForURLPromise(url, type) {
    const uiSourceCode = this.uiSourceCodeForURL(url, type);
    if (uiSourceCode) {
      return Promise.resolve(uiSourceCode);
    }
    return new Promise((resolve) => {
      const descriptor = this.addEventListener(Events.UISourceCodeAdded, (event) => {
        const uiSourceCode2 = event.data;
        if (uiSourceCode2.url() === url) {
          if (!type || type === uiSourceCode2.project().type()) {
            this.removeEventListener(Events.UISourceCodeAdded, descriptor.listener);
            resolve(uiSourceCode2);
          }
        }
      });
    });
  }
  uiSourceCodeForURL(url, type) {
    for (const project of this.projectsInternal.values()) {
      if (!type || project.type() === type) {
        const uiSourceCode = project.uiSourceCodeForURL(url);
        if (uiSourceCode) {
          return uiSourceCode;
        }
      }
    }
    return null;
  }
  uiSourceCodesForProjectType(type) {
    const result = [];
    for (const project of this.projectsInternal.values()) {
      if (project.type() === type) {
        result.push(...project.uiSourceCodes());
      }
    }
    return result;
  }
  addProject(project) {
    console.assert(!this.projectsInternal.has(project.id()), `A project with id ${project.id()} already exists!`);
    this.projectsInternal.set(project.id(), project);
    this.dispatchEventToListeners(Events.ProjectAdded, project);
  }
  removeProject(project) {
    this.projectsInternal.delete(project.id());
    this.dispatchEventToListeners(Events.ProjectRemoved, project);
  }
  project(projectId) {
    return this.projectsInternal.get(projectId) || null;
  }
  projects() {
    return [...this.projectsInternal.values()];
  }
  projectsForType(type) {
    function filterByType(project) {
      return project.type() === type;
    }
    return this.projects().filter(filterByType);
  }
  uiSourceCodes() {
    const result = [];
    for (const project of this.projectsInternal.values()) {
      result.push(...project.uiSourceCodes());
    }
    return result;
  }
  setHasResourceContentTrackingExtensions(hasExtensions) {
    this.hasResourceContentTrackingExtensionsInternal = hasExtensions;
  }
  hasResourceContentTrackingExtensions() {
    return this.hasResourceContentTrackingExtensionsInternal;
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["UISourceCodeAdded"] = "UISourceCodeAdded";
  Events2["UISourceCodeRemoved"] = "UISourceCodeRemoved";
  Events2["UISourceCodeRenamed"] = "UISourceCodeRenamed";
  Events2["WorkingCopyChanged"] = "WorkingCopyChanged";
  Events2["WorkingCopyCommitted"] = "WorkingCopyCommitted";
  Events2["WorkingCopyCommittedByUser"] = "WorkingCopyCommittedByUser";
  Events2["ProjectAdded"] = "ProjectAdded";
  Events2["ProjectRemoved"] = "ProjectRemoved";
  return Events2;
})(Events || {});
//# sourceMappingURL=WorkspaceImpl.js.map
