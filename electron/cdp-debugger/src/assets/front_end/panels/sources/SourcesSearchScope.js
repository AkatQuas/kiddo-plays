import * as Common from "../../core/common/common.js";
import * as Platform from "../../core/platform/platform.js";
import * as Bindings from "../../models/bindings/bindings.js";
import * as Persistence from "../../models/persistence/persistence.js";
import * as TextUtils from "../../models/text_utils/text_utils.js";
import * as Workspace from "../../models/workspace/workspace.js";
export class SourcesSearchScope {
  searchId;
  searchResultCandidates;
  searchResultCallback;
  searchFinishedCallback;
  searchConfig;
  constructor() {
    this.searchId = 0;
    this.searchResultCandidates = [];
    this.searchResultCallback = null;
    this.searchFinishedCallback = null;
    this.searchConfig = null;
  }
  static filesComparator(uiSourceCode1, uiSourceCode2) {
    if (uiSourceCode1.isDirty() && !uiSourceCode2.isDirty()) {
      return -1;
    }
    if (!uiSourceCode1.isDirty() && uiSourceCode2.isDirty()) {
      return 1;
    }
    const isFileSystem1 = uiSourceCode1.project().type() === Workspace.Workspace.projectTypes.FileSystem && !Persistence.Persistence.PersistenceImpl.instance().binding(uiSourceCode1);
    const isFileSystem2 = uiSourceCode2.project().type() === Workspace.Workspace.projectTypes.FileSystem && !Persistence.Persistence.PersistenceImpl.instance().binding(uiSourceCode2);
    if (isFileSystem1 !== isFileSystem2) {
      return isFileSystem1 ? 1 : -1;
    }
    const url1 = uiSourceCode1.url();
    const url2 = uiSourceCode2.url();
    if (url1 && !url2) {
      return -1;
    }
    if (!url1 && url2) {
      return 1;
    }
    return Platform.StringUtilities.naturalOrderComparator(uiSourceCode1.fullDisplayName(), uiSourceCode2.fullDisplayName());
  }
  performIndexing(progress) {
    this.stopSearch();
    const projects = this.projects();
    const compositeProgress = new Common.Progress.CompositeProgress(progress);
    for (let i = 0; i < projects.length; ++i) {
      const project = projects[i];
      const projectProgress = compositeProgress.createSubProgress(project.uiSourceCodes().length);
      project.indexContent(projectProgress);
    }
  }
  projects() {
    const searchInAnonymousAndContentScripts = Common.Settings.Settings.instance().moduleSetting("searchInAnonymousAndContentScripts").get();
    return Workspace.Workspace.WorkspaceImpl.instance().projects().filter((project) => {
      if (project.type() === Workspace.Workspace.projectTypes.Service) {
        return false;
      }
      if (!searchInAnonymousAndContentScripts && project.isServiceProject() && project.type() !== Workspace.Workspace.projectTypes.Formatter) {
        return false;
      }
      if (!searchInAnonymousAndContentScripts && project.type() === Workspace.Workspace.projectTypes.ContentScripts) {
        return false;
      }
      return true;
    });
  }
  performSearch(searchConfig, progress, searchResultCallback, searchFinishedCallback) {
    this.stopSearch();
    this.searchResultCandidates = [];
    this.searchResultCallback = searchResultCallback;
    this.searchFinishedCallback = searchFinishedCallback;
    this.searchConfig = searchConfig;
    const promises = [];
    const compositeProgress = new Common.Progress.CompositeProgress(progress);
    const searchContentProgress = compositeProgress.createSubProgress();
    const findMatchingFilesProgress = new Common.Progress.CompositeProgress(compositeProgress.createSubProgress());
    for (const project of this.projects()) {
      const weight = project.uiSourceCodes().length;
      const findMatchingFilesInProjectProgress = findMatchingFilesProgress.createSubProgress(weight);
      const filesMatchingFileQuery = this.projectFilesMatchingFileQuery(project, searchConfig);
      const promise = project.findFilesMatchingSearchRequest(searchConfig, filesMatchingFileQuery, findMatchingFilesInProjectProgress).then(this.processMatchingFilesForProject.bind(this, this.searchId, project, searchConfig, filesMatchingFileQuery));
      promises.push(promise);
    }
    void Promise.all(promises).then(this.processMatchingFiles.bind(this, this.searchId, searchContentProgress, this.searchFinishedCallback.bind(this, true)));
  }
  projectFilesMatchingFileQuery(project, searchConfig, dirtyOnly) {
    const result = [];
    const uiSourceCodes = project.uiSourceCodes();
    for (let i = 0; i < uiSourceCodes.length; ++i) {
      const uiSourceCode = uiSourceCodes[i];
      if (!uiSourceCode.contentType().isTextType()) {
        continue;
      }
      const binding = Persistence.Persistence.PersistenceImpl.instance().binding(uiSourceCode);
      if (binding && binding.network === uiSourceCode) {
        continue;
      }
      if (dirtyOnly && !uiSourceCode.isDirty()) {
        continue;
      }
      if (searchConfig.filePathMatchesFileQuery(uiSourceCode.fullDisplayName())) {
        result.push(uiSourceCode.url());
      }
    }
    result.sort(Platform.StringUtilities.naturalOrderComparator);
    return result;
  }
  processMatchingFilesForProject(searchId, project, searchConfig, filesMatchingFileQuery, files) {
    if (searchId !== this.searchId && this.searchFinishedCallback) {
      this.searchFinishedCallback(false);
      return;
    }
    files.sort(Platform.StringUtilities.naturalOrderComparator);
    files = Platform.ArrayUtilities.intersectOrdered(files, filesMatchingFileQuery, Platform.StringUtilities.naturalOrderComparator);
    const dirtyFiles = this.projectFilesMatchingFileQuery(project, searchConfig, true);
    files = Platform.ArrayUtilities.mergeOrdered(files, dirtyFiles, Platform.StringUtilities.naturalOrderComparator);
    const uiSourceCodes = [];
    for (const file of files) {
      const uiSourceCode = project.uiSourceCodeForURL(file);
      if (!uiSourceCode) {
        continue;
      }
      const script = Bindings.DefaultScriptMapping.DefaultScriptMapping.scriptForUISourceCode(uiSourceCode);
      if (script && !script.isAnonymousScript()) {
        continue;
      }
      uiSourceCodes.push(uiSourceCode);
    }
    uiSourceCodes.sort(SourcesSearchScope.filesComparator);
    this.searchResultCandidates = Platform.ArrayUtilities.mergeOrdered(this.searchResultCandidates, uiSourceCodes, SourcesSearchScope.filesComparator);
  }
  processMatchingFiles(searchId, progress, callback) {
    if (searchId !== this.searchId && this.searchFinishedCallback) {
      this.searchFinishedCallback(false);
      return;
    }
    const files = this.searchResultCandidates;
    if (!files.length) {
      progress.done();
      callback();
      return;
    }
    progress.setTotalWork(files.length);
    let fileIndex = 0;
    const maxFileContentRequests = 20;
    let callbacksLeft = 0;
    for (let i = 0; i < maxFileContentRequests && i < files.length; ++i) {
      scheduleSearchInNextFileOrFinish.call(this);
    }
    function searchInNextFile(uiSourceCode) {
      if (uiSourceCode.isDirty()) {
        contentLoaded.call(this, uiSourceCode, uiSourceCode.workingCopy());
      } else {
        void uiSourceCode.requestContent().then((deferredContent) => {
          contentLoaded.call(this, uiSourceCode, deferredContent.content || "");
        });
      }
    }
    function scheduleSearchInNextFileOrFinish() {
      if (fileIndex >= files.length) {
        if (!callbacksLeft) {
          progress.done();
          callback();
          return;
        }
        return;
      }
      ++callbacksLeft;
      const uiSourceCode = files[fileIndex++];
      window.setTimeout(searchInNextFile.bind(this, uiSourceCode), 0);
    }
    function contentLoaded(uiSourceCode, content) {
      function matchesComparator(a, b) {
        return a.lineNumber - b.lineNumber;
      }
      progress.incrementWorked(1);
      let matches = [];
      const searchConfig = this.searchConfig;
      const queries = searchConfig.queries();
      if (content !== null) {
        for (let i = 0; i < queries.length; ++i) {
          const nextMatches = TextUtils.TextUtils.performSearchInContent(content, queries[i], !searchConfig.ignoreCase(), searchConfig.isRegex());
          matches = Platform.ArrayUtilities.mergeOrdered(matches, nextMatches, matchesComparator);
        }
      }
      if (matches && this.searchResultCallback) {
        const searchResult = new FileBasedSearchResult(uiSourceCode, matches);
        this.searchResultCallback(searchResult);
      }
      --callbacksLeft;
      scheduleSearchInNextFileOrFinish.call(this);
    }
  }
  stopSearch() {
    ++this.searchId;
  }
}
export class FileBasedSearchResult {
  uiSourceCode;
  searchMatches;
  constructor(uiSourceCode, searchMatches) {
    this.uiSourceCode = uiSourceCode;
    this.searchMatches = searchMatches;
  }
  label() {
    return this.uiSourceCode.displayName();
  }
  description() {
    return this.uiSourceCode.fullDisplayName();
  }
  matchesCount() {
    return this.searchMatches.length;
  }
  matchLineContent(index) {
    return this.searchMatches[index].lineContent;
  }
  matchRevealable(index) {
    const match = this.searchMatches[index];
    return this.uiSourceCode.uiLocation(match.lineNumber, match.columnNumber);
  }
  matchLabel(index) {
    return this.searchMatches[index].lineNumber + 1;
  }
}
//# sourceMappingURL=SourcesSearchScope.js.map
