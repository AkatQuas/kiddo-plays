import * as Common from "../../core/common/common.js";
import * as Host from "../../core/host/host.js";
import * as i18n from "../../core/i18n/i18n.js";
import * as Platform from "../../core/platform/platform.js";
import { Events } from "./IsolatedFileSystemManager.js";
import { PlatformFileSystem } from "./PlatformFileSystem.js";
const UIStrings = {
  fileSystemErrorS: "File system error: {PH1}",
  blobCouldNotBeLoaded: "Blob could not be loaded.",
  cantReadFileSS: "Can't read file: {PH1}: {PH2}",
  unknownErrorReadingFileS: "Unknown error reading file: {PH1}",
  linkedToS: "Linked to {PH1}"
};
const str_ = i18n.i18n.registerUIStrings("models/persistence/IsolatedFileSystem.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class IsolatedFileSystem extends PlatformFileSystem {
  manager;
  embedderPathInternal;
  domFileSystem;
  excludedFoldersSetting;
  excludedFoldersInternal;
  excludedEmbedderFolders;
  initialFilePathsInternal;
  initialGitFoldersInternal;
  fileLocks;
  constructor(manager, path, embedderPath, domFileSystem, type) {
    super(path, type);
    this.manager = manager;
    this.embedderPathInternal = embedderPath;
    this.domFileSystem = domFileSystem;
    this.excludedFoldersSetting = Common.Settings.Settings.instance().createLocalSetting("workspaceExcludedFolders", {});
    this.excludedFoldersInternal = new Set(this.excludedFoldersSetting.get()[path] || []);
    this.excludedEmbedderFolders = [];
    this.initialFilePathsInternal = /* @__PURE__ */ new Set();
    this.initialGitFoldersInternal = /* @__PURE__ */ new Set();
    this.fileLocks = /* @__PURE__ */ new Map();
  }
  static async create(manager, path, embedderPath, type, name, rootURL) {
    const domFileSystem = Host.InspectorFrontendHost.InspectorFrontendHostInstance.isolatedFileSystem(name, rootURL);
    if (!domFileSystem) {
      return null;
    }
    const fileSystem = new IsolatedFileSystem(manager, path, embedderPath, domFileSystem, type);
    return fileSystem.initializeFilePaths().then(() => fileSystem).catch((error) => {
      console.error(error);
      return null;
    });
  }
  static errorMessage(error) {
    return i18nString(UIStrings.fileSystemErrorS, { PH1: error.message });
  }
  serializedFileOperation(path, operation) {
    const promise = Promise.resolve(this.fileLocks.get(path)).then(() => operation.call(null));
    this.fileLocks.set(path, promise);
    return promise;
  }
  getMetadata(path) {
    let fulfill;
    const promise = new Promise((f) => {
      fulfill = f;
    });
    this.domFileSystem.root.getFile(Common.ParsedURL.ParsedURL.encodedPathToRawPathString(path), void 0, fileEntryLoaded, errorHandler);
    return promise;
    function fileEntryLoaded(entry) {
      entry.getMetadata(fulfill, errorHandler);
    }
    function errorHandler(error) {
      const errorMessage = IsolatedFileSystem.errorMessage(error);
      console.error(errorMessage + " when getting file metadata '" + path);
      fulfill(null);
    }
  }
  initialFilePaths() {
    return [...this.initialFilePathsInternal];
  }
  initialGitFolders() {
    return [...this.initialGitFoldersInternal];
  }
  embedderPath() {
    return this.embedderPathInternal;
  }
  initializeFilePaths() {
    return new Promise((fulfill) => {
      let pendingRequests = 1;
      const boundInnerCallback = innerCallback.bind(this);
      this.requestEntries(Platform.DevToolsPath.EmptyRawPathString, boundInnerCallback);
      function innerCallback(entries) {
        for (let i = 0; i < entries.length; ++i) {
          const entry = entries[i];
          if (!entry.isDirectory) {
            if (this.isFileExcluded(Common.ParsedURL.ParsedURL.rawPathToEncodedPathString(entry.fullPath))) {
              continue;
            }
            this.initialFilePathsInternal.add(Common.ParsedURL.ParsedURL.rawPathToEncodedPathString(Common.ParsedURL.ParsedURL.substr(entry.fullPath, 1)));
          } else {
            if (entry.fullPath.endsWith("/.git")) {
              const lastSlash = entry.fullPath.lastIndexOf("/");
              const parentFolder = Common.ParsedURL.ParsedURL.substr(entry.fullPath, 1, lastSlash);
              this.initialGitFoldersInternal.add(Common.ParsedURL.ParsedURL.rawPathToEncodedPathString(parentFolder));
            }
            if (this.isFileExcluded(Common.ParsedURL.ParsedURL.concatenate(Common.ParsedURL.ParsedURL.rawPathToEncodedPathString(entry.fullPath), "/"))) {
              const url = Common.ParsedURL.ParsedURL.concatenate(this.path(), Common.ParsedURL.ParsedURL.rawPathToEncodedPathString(entry.fullPath));
              this.excludedEmbedderFolders.push(Common.ParsedURL.ParsedURL.urlToRawPathString(url, Host.Platform.isWin()));
              continue;
            }
            ++pendingRequests;
            this.requestEntries(entry.fullPath, boundInnerCallback);
          }
        }
        if (--pendingRequests === 0) {
          fulfill();
        }
      }
    });
  }
  async createFoldersIfNotExist(folderPath) {
    let dirEntry = await new Promise((resolve) => this.domFileSystem.root.getDirectory(folderPath, void 0, resolve, () => resolve(null)));
    if (dirEntry) {
      return dirEntry;
    }
    const paths = folderPath.split("/");
    let activePath = "";
    for (const path of paths) {
      activePath = activePath + "/" + path;
      dirEntry = await this.innerCreateFolderIfNeeded(activePath);
      if (!dirEntry) {
        return null;
      }
    }
    return dirEntry;
  }
  innerCreateFolderIfNeeded(path) {
    return new Promise((resolve) => {
      this.domFileSystem.root.getDirectory(path, { create: true }, (dirEntry) => resolve(dirEntry), (error) => {
        const errorMessage = IsolatedFileSystem.errorMessage(error);
        console.error(errorMessage + " trying to create directory '" + path + "'");
        resolve(null);
      });
    });
  }
  async createFile(path, name) {
    const dirEntry = await this.createFoldersIfNotExist(Common.ParsedURL.ParsedURL.encodedPathToRawPathString(path));
    if (!dirEntry) {
      return null;
    }
    const fileEntry = await this.serializedFileOperation(path, createFileCandidate.bind(this, name || "NewFile"));
    if (!fileEntry) {
      return null;
    }
    return Common.ParsedURL.ParsedURL.rawPathToEncodedPathString(Common.ParsedURL.ParsedURL.substr(fileEntry.fullPath, 1));
    function createFileCandidate(name2, newFileIndex) {
      return new Promise((resolve) => {
        const nameCandidate = Common.ParsedURL.ParsedURL.concatenate(name2, (newFileIndex || "").toString());
        dirEntry.getFile(nameCandidate, { create: true, exclusive: true }, resolve, (error) => {
          if (error.name === "InvalidModificationError") {
            resolve(createFileCandidate.call(this, name2, newFileIndex ? newFileIndex + 1 : 1));
            return;
          }
          const errorMessage = IsolatedFileSystem.errorMessage(error);
          console.error(errorMessage + " when testing if file exists '" + (this.path() + "/" + path + "/" + nameCandidate) + "'");
          resolve(null);
        });
      });
    }
  }
  deleteFile(path) {
    let resolveCallback;
    const promise = new Promise((resolve) => {
      resolveCallback = resolve;
    });
    this.domFileSystem.root.getFile(Common.ParsedURL.ParsedURL.encodedPathToRawPathString(path), void 0, fileEntryLoaded.bind(this), errorHandler.bind(this));
    return promise;
    function fileEntryLoaded(fileEntry) {
      fileEntry.remove(fileEntryRemoved, errorHandler.bind(this));
    }
    function fileEntryRemoved() {
      resolveCallback(true);
    }
    function errorHandler(error) {
      const errorMessage = IsolatedFileSystem.errorMessage(error);
      console.error(errorMessage + " when deleting file '" + (this.path() + "/" + path) + "'");
      resolveCallback(false);
    }
  }
  requestFileBlob(path) {
    return new Promise((resolve) => {
      this.domFileSystem.root.getFile(Common.ParsedURL.ParsedURL.encodedPathToRawPathString(path), void 0, (entry) => {
        entry.file(resolve, errorHandler.bind(this));
      }, errorHandler.bind(this));
      function errorHandler(error) {
        if (error.name === "NotFoundError") {
          resolve(null);
          return;
        }
        const errorMessage = IsolatedFileSystem.errorMessage(error);
        console.error(errorMessage + " when getting content for file '" + (this.path() + "/" + path) + "'");
        resolve(null);
      }
    });
  }
  requestFileContent(path) {
    return this.serializedFileOperation(path, () => this.innerRequestFileContent(path));
  }
  async innerRequestFileContent(path) {
    const blob = await this.requestFileBlob(path);
    if (!blob) {
      return { content: null, error: i18nString(UIStrings.blobCouldNotBeLoaded), isEncoded: false };
    }
    const reader = new FileReader();
    const extension = Common.ParsedURL.ParsedURL.extractExtension(path);
    const encoded = BinaryExtensions.has(extension);
    const readPromise = new Promise((x) => {
      reader.onloadend = x;
    });
    if (encoded) {
      reader.readAsBinaryString(blob);
    } else {
      reader.readAsText(blob);
    }
    await readPromise;
    if (reader.error) {
      const error2 = i18nString(UIStrings.cantReadFileSS, { PH1: path, PH2: reader.error.toString() });
      console.error(error2);
      return { content: null, isEncoded: false, error: error2 };
    }
    let result = null;
    let error = null;
    try {
      result = reader.result;
    } catch (e) {
      result = null;
      error = i18nString(UIStrings.cantReadFileSS, { PH1: path, PH2: e.message });
    }
    if (result === void 0 || result === null) {
      error = error || i18nString(UIStrings.unknownErrorReadingFileS, { PH1: path });
      console.error(error);
      return { content: null, isEncoded: false, error };
    }
    return { isEncoded: encoded, content: encoded ? btoa(result) : result };
  }
  async setFileContent(path, content, isBase64) {
    Host.userMetrics.actionTaken(Host.UserMetrics.Action.FileSavedInWorkspace);
    let callback;
    const innerSetFileContent = () => {
      const promise = new Promise((x) => {
        callback = x;
      });
      this.domFileSystem.root.getFile(Common.ParsedURL.ParsedURL.encodedPathToRawPathString(path), { create: true }, fileEntryLoaded.bind(this), errorHandler.bind(this));
      return promise;
    };
    void this.serializedFileOperation(path, innerSetFileContent);
    function fileEntryLoaded(entry) {
      entry.createWriter(fileWriterCreated.bind(this), errorHandler.bind(this));
    }
    async function fileWriterCreated(fileWriter) {
      fileWriter.onerror = errorHandler.bind(this);
      fileWriter.onwriteend = fileWritten;
      let blob;
      if (isBase64) {
        blob = await (await fetch(`data:application/octet-stream;base64,${content}`)).blob();
      } else {
        blob = new Blob([content], { type: "text/plain" });
      }
      fileWriter.write(blob);
      function fileWritten() {
        fileWriter.onwriteend = callback;
        fileWriter.truncate(blob.size);
      }
    }
    function errorHandler(error) {
      const errorMessage = IsolatedFileSystem.errorMessage(error);
      console.error(errorMessage + " when setting content for file '" + (this.path() + "/" + path) + "'");
      callback(void 0);
    }
  }
  renameFile(path, newName, callback) {
    newName = newName ? Common.ParsedURL.ParsedURL.trim(newName) : newName;
    if (!newName || newName.indexOf("/") !== -1) {
      callback(false);
      return;
    }
    let fileEntry;
    let dirEntry;
    this.domFileSystem.root.getFile(Common.ParsedURL.ParsedURL.encodedPathToRawPathString(path), void 0, fileEntryLoaded.bind(this), errorHandler.bind(this));
    function fileEntryLoaded(entry) {
      if (entry.name === newName) {
        callback(false);
        return;
      }
      fileEntry = entry;
      fileEntry.getParent(dirEntryLoaded.bind(this), errorHandler.bind(this));
    }
    function dirEntryLoaded(entry) {
      dirEntry = entry;
      dirEntry.getFile(newName, void 0, newFileEntryLoaded, newFileEntryLoadErrorHandler.bind(this));
    }
    function newFileEntryLoaded(_entry) {
      callback(false);
    }
    function newFileEntryLoadErrorHandler(error) {
      if (error.name !== "NotFoundError") {
        callback(false);
        return;
      }
      fileEntry.moveTo(dirEntry, newName, fileRenamed, errorHandler.bind(this));
    }
    function fileRenamed(entry) {
      callback(true, entry.name);
    }
    function errorHandler(error) {
      const errorMessage = IsolatedFileSystem.errorMessage(error);
      console.error(errorMessage + " when renaming file '" + (this.path() + "/" + path) + "' to '" + newName + "'");
      callback(false);
    }
  }
  readDirectory(dirEntry, callback) {
    const dirReader = dirEntry.createReader();
    let entries = [];
    function innerCallback(results) {
      if (!results.length) {
        callback(entries.sort());
      } else {
        entries = entries.concat(toArray(results));
        dirReader.readEntries(innerCallback, errorHandler);
      }
    }
    function toArray(list) {
      return Array.prototype.slice.call(list || [], 0);
    }
    dirReader.readEntries(innerCallback, errorHandler);
    function errorHandler(error) {
      const errorMessage = IsolatedFileSystem.errorMessage(error);
      console.error(errorMessage + " when reading directory '" + dirEntry.fullPath + "'");
      callback([]);
    }
  }
  requestEntries(path, callback) {
    this.domFileSystem.root.getDirectory(path, void 0, innerCallback.bind(this), errorHandler);
    function innerCallback(dirEntry) {
      this.readDirectory(dirEntry, callback);
    }
    function errorHandler(error) {
      const errorMessage = IsolatedFileSystem.errorMessage(error);
      console.error(errorMessage + " when requesting entry '" + path + "'");
      callback([]);
    }
  }
  saveExcludedFolders() {
    const settingValue = this.excludedFoldersSetting.get();
    settingValue[this.path()] = [...this.excludedFoldersInternal];
    this.excludedFoldersSetting.set(settingValue);
  }
  addExcludedFolder(path) {
    this.excludedFoldersInternal.add(path);
    this.saveExcludedFolders();
    this.manager.dispatchEventToListeners(Events.ExcludedFolderAdded, path);
  }
  removeExcludedFolder(path) {
    this.excludedFoldersInternal.delete(path);
    this.saveExcludedFolders();
    this.manager.dispatchEventToListeners(Events.ExcludedFolderRemoved, path);
  }
  fileSystemRemoved() {
    const settingValue = this.excludedFoldersSetting.get();
    delete settingValue[this.path()];
    this.excludedFoldersSetting.set(settingValue);
  }
  isFileExcluded(folderPath) {
    if (this.excludedFoldersInternal.has(folderPath)) {
      return true;
    }
    const regex = this.manager.workspaceFolderExcludePatternSetting().asRegExp();
    return Boolean(regex && regex.test(Common.ParsedURL.ParsedURL.encodedPathToRawPathString(folderPath)));
  }
  excludedFolders() {
    return this.excludedFoldersInternal;
  }
  searchInPath(query, progress) {
    return new Promise((resolve) => {
      const requestId = this.manager.registerCallback(innerCallback);
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.searchInPath(requestId, this.embedderPathInternal, query);
      function innerCallback(files) {
        resolve(files.map((path) => Common.ParsedURL.ParsedURL.rawPathToUrlString(path)));
        progress.incrementWorked(1);
      }
    });
  }
  indexContent(progress) {
    progress.setTotalWork(1);
    const requestId = this.manager.registerProgress(progress);
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.indexPath(requestId, this.embedderPathInternal, JSON.stringify(this.excludedEmbedderFolders));
  }
  mimeFromPath(path) {
    return Common.ResourceType.ResourceType.mimeFromURL(path) || "text/plain";
  }
  canExcludeFolder(path) {
    return Boolean(path) && this.type() !== "overrides";
  }
  contentType(path) {
    const extension = Common.ParsedURL.ParsedURL.extractExtension(path);
    if (STYLE_SHEET_EXTENSIONS.has(extension)) {
      return Common.ResourceType.resourceTypes.Stylesheet;
    }
    if (DOCUMENT_EXTENSIONS.has(extension)) {
      return Common.ResourceType.resourceTypes.Document;
    }
    if (IMAGE_EXTENSIONS.has(extension)) {
      return Common.ResourceType.resourceTypes.Image;
    }
    if (SCRIPT_EXTENSIONS.has(extension)) {
      return Common.ResourceType.resourceTypes.Script;
    }
    return BinaryExtensions.has(extension) ? Common.ResourceType.resourceTypes.Other : Common.ResourceType.resourceTypes.Document;
  }
  tooltipForURL(url) {
    const path = Platform.StringUtilities.trimMiddle(Common.ParsedURL.ParsedURL.urlToRawPathString(url, Host.Platform.isWin()), 150);
    return i18nString(UIStrings.linkedToS, { PH1: path });
  }
  supportsAutomapping() {
    return this.type() !== "overrides";
  }
}
const STYLE_SHEET_EXTENSIONS = /* @__PURE__ */ new Set(["css", "scss", "sass", "less"]);
const DOCUMENT_EXTENSIONS = /* @__PURE__ */ new Set(["htm", "html", "asp", "aspx", "phtml", "jsp"]);
const SCRIPT_EXTENSIONS = /* @__PURE__ */ new Set([
  "asp",
  "aspx",
  "c",
  "cc",
  "cljs",
  "coffee",
  "cpp",
  "cs",
  "dart",
  "java",
  "js",
  "jsp",
  "jsx",
  "h",
  "m",
  "mjs",
  "mm",
  "py",
  "sh",
  "ts",
  "tsx",
  "ls"
]);
const IMAGE_EXTENSIONS = /* @__PURE__ */ new Set(["jpeg", "jpg", "svg", "gif", "webp", "png", "ico", "tiff", "tif", "bmp"]);
export const BinaryExtensions = /* @__PURE__ */ new Set([
  "cmd",
  "com",
  "exe",
  "a",
  "ar",
  "iso",
  "tar",
  "bz2",
  "gz",
  "lz",
  "lzma",
  "z",
  "7z",
  "apk",
  "arc",
  "cab",
  "dmg",
  "jar",
  "pak",
  "rar",
  "zip",
  "3gp",
  "aac",
  "aiff",
  "flac",
  "m4a",
  "mmf",
  "mp3",
  "ogg",
  "oga",
  "raw",
  "sln",
  "wav",
  "wma",
  "webm",
  "mkv",
  "flv",
  "vob",
  "ogv",
  "gifv",
  "avi",
  "mov",
  "qt",
  "mp4",
  "m4p",
  "m4v",
  "mpg",
  "mpeg",
  "jpeg",
  "jpg",
  "gif",
  "webp",
  "png",
  "ico",
  "tiff",
  "tif",
  "bmp"
]);
//# sourceMappingURL=IsolatedFileSystem.js.map
