import * as Common from "../common/common.js";
import * as i18n from "../i18n/i18n.js";
import * as Protocol from "../../generated/protocol.js";
import { Events as RuntimeModelEvents, RuntimeModel } from "./RuntimeModel.js";
import { Capability, Type } from "./Target.js";
import { SDKModel } from "./SDKModel.js";
import { TargetManager } from "./TargetManager.js";
const UIStrings = {
  running: "running",
  starting: "starting",
  stopped: "stopped",
  stopping: "stopping",
  activated: "activated",
  activating: "activating",
  installed: "installed",
  installing: "installing",
  new: "new",
  redundant: "redundant",
  sSS: "{PH1} #{PH2} ({PH3})"
};
const str_ = i18n.i18n.registerUIStrings("core/sdk/ServiceWorkerManager.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
export class ServiceWorkerManager extends SDKModel {
  #agent;
  #registrationsInternal;
  #enabled;
  #forceUpdateSetting;
  serviceWorkerNetworkRequestsPanelStatus;
  constructor(target) {
    super(target);
    target.registerServiceWorkerDispatcher(new ServiceWorkerDispatcher(this));
    this.#agent = target.serviceWorkerAgent();
    this.#registrationsInternal = /* @__PURE__ */ new Map();
    this.#enabled = false;
    void this.enable();
    this.#forceUpdateSetting = Common.Settings.Settings.instance().createSetting("serviceWorkerUpdateOnReload", false);
    if (this.#forceUpdateSetting.get()) {
      this.forceUpdateSettingChanged();
    }
    this.#forceUpdateSetting.addChangeListener(this.forceUpdateSettingChanged, this);
    new ServiceWorkerContextNamer(target, this);
    this.serviceWorkerNetworkRequestsPanelStatus = {
      isOpen: false,
      openedAt: 0
    };
  }
  async enable() {
    if (this.#enabled) {
      return;
    }
    this.#enabled = true;
    await this.#agent.invoke_enable();
  }
  async disable() {
    if (!this.#enabled) {
      return;
    }
    this.#enabled = false;
    this.#registrationsInternal.clear();
    await this.#agent.invoke_enable();
  }
  registrations() {
    return this.#registrationsInternal;
  }
  hasRegistrationForURLs(urls) {
    for (const registration of this.#registrationsInternal.values()) {
      if (urls.filter((url) => url && url.startsWith(registration.scopeURL)).length === urls.length) {
        return true;
      }
    }
    return false;
  }
  findVersion(versionId) {
    for (const registration of this.registrations().values()) {
      const version = registration.versions.get(versionId);
      if (version) {
        return version;
      }
    }
    return null;
  }
  deleteRegistration(registrationId) {
    const registration = this.#registrationsInternal.get(registrationId);
    if (!registration) {
      return;
    }
    if (registration.isRedundant()) {
      this.#registrationsInternal.delete(registrationId);
      this.dispatchEventToListeners(Events.RegistrationDeleted, registration);
      return;
    }
    registration.deleting = true;
    for (const version of registration.versions.values()) {
      void this.stopWorker(version.id);
    }
    void this.unregister(registration.scopeURL);
  }
  async updateRegistration(registrationId) {
    const registration = this.#registrationsInternal.get(registrationId);
    if (!registration) {
      return;
    }
    await this.#agent.invoke_updateRegistration({ scopeURL: registration.scopeURL });
  }
  async deliverPushMessage(registrationId, data) {
    const registration = this.#registrationsInternal.get(registrationId);
    if (!registration) {
      return;
    }
    const origin = Common.ParsedURL.ParsedURL.extractOrigin(registration.scopeURL);
    await this.#agent.invoke_deliverPushMessage({ origin, registrationId, data });
  }
  async dispatchSyncEvent(registrationId, tag, lastChance) {
    const registration = this.#registrationsInternal.get(registrationId);
    if (!registration) {
      return;
    }
    const origin = Common.ParsedURL.ParsedURL.extractOrigin(registration.scopeURL);
    await this.#agent.invoke_dispatchSyncEvent({ origin, registrationId, tag, lastChance });
  }
  async dispatchPeriodicSyncEvent(registrationId, tag) {
    const registration = this.#registrationsInternal.get(registrationId);
    if (!registration) {
      return;
    }
    const origin = Common.ParsedURL.ParsedURL.extractOrigin(registration.scopeURL);
    await this.#agent.invoke_dispatchPeriodicSyncEvent({ origin, registrationId, tag });
  }
  async unregister(scopeURL) {
    await this.#agent.invoke_unregister({ scopeURL });
  }
  async startWorker(scopeURL) {
    await this.#agent.invoke_startWorker({ scopeURL });
  }
  async skipWaiting(scopeURL) {
    await this.#agent.invoke_skipWaiting({ scopeURL });
  }
  async stopWorker(versionId) {
    await this.#agent.invoke_stopWorker({ versionId });
  }
  async inspectWorker(versionId) {
    await this.#agent.invoke_inspectWorker({ versionId });
  }
  workerRegistrationUpdated(registrations) {
    for (const payload of registrations) {
      let registration = this.#registrationsInternal.get(payload.registrationId);
      if (!registration) {
        registration = new ServiceWorkerRegistration(payload);
        this.#registrationsInternal.set(payload.registrationId, registration);
        this.dispatchEventToListeners(Events.RegistrationUpdated, registration);
        continue;
      }
      registration.update(payload);
      if (registration.shouldBeRemoved()) {
        this.#registrationsInternal.delete(registration.id);
        this.dispatchEventToListeners(Events.RegistrationDeleted, registration);
      } else {
        this.dispatchEventToListeners(Events.RegistrationUpdated, registration);
      }
    }
  }
  workerVersionUpdated(versions) {
    const registrations = /* @__PURE__ */ new Set();
    for (const payload of versions) {
      const registration = this.#registrationsInternal.get(payload.registrationId);
      if (!registration) {
        continue;
      }
      registration.updateVersion(payload);
      registrations.add(registration);
    }
    for (const registration of registrations) {
      if (registration.shouldBeRemoved()) {
        this.#registrationsInternal.delete(registration.id);
        this.dispatchEventToListeners(Events.RegistrationDeleted, registration);
      } else {
        this.dispatchEventToListeners(Events.RegistrationUpdated, registration);
      }
    }
  }
  workerErrorReported(payload) {
    const registration = this.#registrationsInternal.get(payload.registrationId);
    if (!registration) {
      return;
    }
    registration.errors.push(payload);
    this.dispatchEventToListeners(Events.RegistrationErrorAdded, { registration, error: payload });
  }
  forceUpdateOnReloadSetting() {
    return this.#forceUpdateSetting;
  }
  forceUpdateSettingChanged() {
    const forceUpdateOnPageLoad = this.#forceUpdateSetting.get();
    void this.#agent.invoke_setForceUpdateOnPageLoad({ forceUpdateOnPageLoad });
  }
}
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["RegistrationUpdated"] = "RegistrationUpdated";
  Events2["RegistrationErrorAdded"] = "RegistrationErrorAdded";
  Events2["RegistrationDeleted"] = "RegistrationDeleted";
  return Events2;
})(Events || {});
class ServiceWorkerDispatcher {
  #manager;
  constructor(manager) {
    this.#manager = manager;
  }
  workerRegistrationUpdated({ registrations }) {
    this.#manager.workerRegistrationUpdated(registrations);
  }
  workerVersionUpdated({ versions }) {
    this.#manager.workerVersionUpdated(versions);
  }
  workerErrorReported({ errorMessage }) {
    this.#manager.workerErrorReported(errorMessage);
  }
}
export class ServiceWorkerVersionState {
  runningStatus;
  status;
  last_updated_timestamp;
  previousState;
  constructor(runningStatus, status, previousState, timestamp) {
    this.runningStatus = runningStatus;
    this.status = status;
    this.last_updated_timestamp = timestamp;
    this.previousState = previousState;
  }
}
export class ServiceWorkerVersion {
  id;
  scriptURL;
  parsedURL;
  securityOrigin;
  scriptLastModified;
  scriptResponseTime;
  controlledClients;
  targetId;
  currentState;
  registration;
  constructor(registration, payload) {
    this.registration = registration;
    this.update(payload);
  }
  update(payload) {
    this.id = payload.versionId;
    this.scriptURL = payload.scriptURL;
    const parsedURL = new Common.ParsedURL.ParsedURL(payload.scriptURL);
    this.securityOrigin = parsedURL.securityOrigin();
    this.currentState = new ServiceWorkerVersionState(payload.runningStatus, payload.status, this.currentState, Date.now());
    this.scriptLastModified = payload.scriptLastModified;
    this.scriptResponseTime = payload.scriptResponseTime;
    if (payload.controlledClients) {
      this.controlledClients = payload.controlledClients.slice();
    } else {
      this.controlledClients = [];
    }
    this.targetId = payload.targetId || null;
  }
  isStartable() {
    return !this.registration.isDeleted && this.isActivated() && this.isStopped();
  }
  isStoppedAndRedundant() {
    return this.runningStatus === Protocol.ServiceWorker.ServiceWorkerVersionRunningStatus.Stopped && this.status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Redundant;
  }
  isStopped() {
    return this.runningStatus === Protocol.ServiceWorker.ServiceWorkerVersionRunningStatus.Stopped;
  }
  isStarting() {
    return this.runningStatus === Protocol.ServiceWorker.ServiceWorkerVersionRunningStatus.Starting;
  }
  isRunning() {
    return this.runningStatus === Protocol.ServiceWorker.ServiceWorkerVersionRunningStatus.Running;
  }
  isStopping() {
    return this.runningStatus === Protocol.ServiceWorker.ServiceWorkerVersionRunningStatus.Stopping;
  }
  isNew() {
    return this.status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.New;
  }
  isInstalling() {
    return this.status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Installing;
  }
  isInstalled() {
    return this.status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Installed;
  }
  isActivating() {
    return this.status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Activating;
  }
  isActivated() {
    return this.status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Activated;
  }
  isRedundant() {
    return this.status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Redundant;
  }
  get status() {
    return this.currentState.status;
  }
  get runningStatus() {
    return this.currentState.runningStatus;
  }
  mode() {
    if (this.isNew() || this.isInstalling()) {
      return ServiceWorkerVersion.Modes.Installing;
    }
    if (this.isInstalled()) {
      return ServiceWorkerVersion.Modes.Waiting;
    }
    if (this.isActivating() || this.isActivated()) {
      return ServiceWorkerVersion.Modes.Active;
    }
    return ServiceWorkerVersion.Modes.Redundant;
  }
}
((ServiceWorkerVersion2) => {
  ServiceWorkerVersion2.RunningStatus = {
    [Protocol.ServiceWorker.ServiceWorkerVersionRunningStatus.Running]: i18nLazyString(UIStrings.running),
    [Protocol.ServiceWorker.ServiceWorkerVersionRunningStatus.Starting]: i18nLazyString(UIStrings.starting),
    [Protocol.ServiceWorker.ServiceWorkerVersionRunningStatus.Stopped]: i18nLazyString(UIStrings.stopped),
    [Protocol.ServiceWorker.ServiceWorkerVersionRunningStatus.Stopping]: i18nLazyString(UIStrings.stopping)
  };
  ServiceWorkerVersion2.Status = {
    [Protocol.ServiceWorker.ServiceWorkerVersionStatus.Activated]: i18nLazyString(UIStrings.activated),
    [Protocol.ServiceWorker.ServiceWorkerVersionStatus.Activating]: i18nLazyString(UIStrings.activating),
    [Protocol.ServiceWorker.ServiceWorkerVersionStatus.Installed]: i18nLazyString(UIStrings.installed),
    [Protocol.ServiceWorker.ServiceWorkerVersionStatus.Installing]: i18nLazyString(UIStrings.installing),
    [Protocol.ServiceWorker.ServiceWorkerVersionStatus.New]: i18nLazyString(UIStrings.new),
    [Protocol.ServiceWorker.ServiceWorkerVersionStatus.Redundant]: i18nLazyString(UIStrings.redundant)
  };
  let Modes;
  ((Modes2) => {
    Modes2["Installing"] = "installing";
    Modes2["Waiting"] = "waiting";
    Modes2["Active"] = "active";
    Modes2["Redundant"] = "redundant";
  })(Modes = ServiceWorkerVersion2.Modes || (ServiceWorkerVersion2.Modes = {}));
})(ServiceWorkerVersion || (ServiceWorkerVersion = {}));
export class ServiceWorkerRegistration {
  #fingerprintInternal;
  id;
  scopeURL;
  securityOrigin;
  isDeleted;
  versions;
  deleting;
  errors;
  constructor(payload) {
    this.update(payload);
    this.versions = /* @__PURE__ */ new Map();
    this.deleting = false;
    this.errors = [];
  }
  update(payload) {
    this.#fingerprintInternal = Symbol("fingerprint");
    this.id = payload.registrationId;
    this.scopeURL = payload.scopeURL;
    const parsedURL = new Common.ParsedURL.ParsedURL(payload.scopeURL);
    this.securityOrigin = parsedURL.securityOrigin();
    this.isDeleted = payload.isDeleted;
  }
  fingerprint() {
    return this.#fingerprintInternal;
  }
  versionsByMode() {
    const result = /* @__PURE__ */ new Map();
    for (const version of this.versions.values()) {
      result.set(version.mode(), version);
    }
    return result;
  }
  updateVersion(payload) {
    this.#fingerprintInternal = Symbol("fingerprint");
    let version = this.versions.get(payload.versionId);
    if (!version) {
      version = new ServiceWorkerVersion(this, payload);
      this.versions.set(payload.versionId, version);
      return version;
    }
    version.update(payload);
    return version;
  }
  isRedundant() {
    for (const version of this.versions.values()) {
      if (!version.isStoppedAndRedundant()) {
        return false;
      }
    }
    return true;
  }
  shouldBeRemoved() {
    return this.isRedundant() && (!this.errors.length || this.deleting);
  }
  canBeRemoved() {
    return this.isDeleted || this.deleting;
  }
  clearErrors() {
    this.#fingerprintInternal = Symbol("fingerprint");
    this.errors = [];
  }
}
class ServiceWorkerContextNamer {
  #target;
  #serviceWorkerManager;
  #versionByTargetId;
  constructor(target, serviceWorkerManager) {
    this.#target = target;
    this.#serviceWorkerManager = serviceWorkerManager;
    this.#versionByTargetId = /* @__PURE__ */ new Map();
    serviceWorkerManager.addEventListener("RegistrationUpdated" /* RegistrationUpdated */, this.registrationsUpdated, this);
    serviceWorkerManager.addEventListener("RegistrationDeleted" /* RegistrationDeleted */, this.registrationsUpdated, this);
    TargetManager.instance().addModelListener(RuntimeModel, RuntimeModelEvents.ExecutionContextCreated, this.executionContextCreated, this);
  }
  registrationsUpdated() {
    this.#versionByTargetId.clear();
    const registrations = this.#serviceWorkerManager.registrations().values();
    for (const registration of registrations) {
      for (const version of registration.versions.values()) {
        if (version.targetId) {
          this.#versionByTargetId.set(version.targetId, version);
        }
      }
    }
    this.updateAllContextLabels();
  }
  executionContextCreated(event) {
    const executionContext = event.data;
    const serviceWorkerTargetId = this.serviceWorkerTargetId(executionContext.target());
    if (!serviceWorkerTargetId) {
      return;
    }
    this.updateContextLabel(executionContext, this.#versionByTargetId.get(serviceWorkerTargetId) || null);
  }
  serviceWorkerTargetId(target) {
    if (target.parentTarget() !== this.#target || target.type() !== Type.ServiceWorker) {
      return null;
    }
    return target.id();
  }
  updateAllContextLabels() {
    for (const target of TargetManager.instance().targets()) {
      const serviceWorkerTargetId = this.serviceWorkerTargetId(target);
      if (!serviceWorkerTargetId) {
        continue;
      }
      const version = this.#versionByTargetId.get(serviceWorkerTargetId) || null;
      const runtimeModel = target.model(RuntimeModel);
      const executionContexts = runtimeModel ? runtimeModel.executionContexts() : [];
      for (const context of executionContexts) {
        this.updateContextLabel(context, version);
      }
    }
  }
  updateContextLabel(context, version) {
    if (!version) {
      context.setLabel("");
      return;
    }
    const parsedUrl = Common.ParsedURL.ParsedURL.fromString(context.origin);
    const label = parsedUrl ? parsedUrl.lastPathComponentWithFragment() : context.name;
    const localizedStatus = ServiceWorkerVersion.Status[version.status];
    context.setLabel(i18nString(UIStrings.sSS, { PH1: label, PH2: version.id, PH3: localizedStatus() }));
  }
}
SDKModel.register(ServiceWorkerManager, { capabilities: Capability.ServiceWorker, autostart: true });
//# sourceMappingURL=ServiceWorkerManager.js.map
