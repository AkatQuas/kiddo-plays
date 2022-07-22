import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
const UIStrings = {
  databaseNoLongerHasExpected: "Database no longer has expected version.",
  anUnexpectedErrorSOccurred: "An unexpected error {PH1} occurred."
};
const str_ = i18n.i18n.registerUIStrings("panels/application/DatabaseModel.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class Database {
  model;
  idInternal;
  domainInternal;
  nameInternal;
  versionInternal;
  constructor(model, id, domain, name, version) {
    this.model = model;
    this.idInternal = id;
    this.domainInternal = domain;
    this.nameInternal = name;
    this.versionInternal = version;
  }
  get id() {
    return this.idInternal;
  }
  get name() {
    return this.nameInternal;
  }
  set name(x) {
    this.nameInternal = x;
  }
  get version() {
    return this.versionInternal;
  }
  set version(x) {
    this.versionInternal = x;
  }
  get domain() {
    return this.domainInternal;
  }
  set domain(x) {
    this.domainInternal = x;
  }
  async tableNames() {
    const { tableNames } = await this.model.agent.invoke_getDatabaseTableNames({ databaseId: this.idInternal }) || [];
    return tableNames.sort();
  }
  async executeSql(query, onSuccess, onError) {
    const response = await this.model.agent.invoke_executeSQL({ "databaseId": this.idInternal, "query": query });
    const error = response.getError() || null;
    if (error) {
      onError(error);
      return;
    }
    const sqlError = response.sqlError;
    if (!sqlError) {
      onSuccess(response.columnNames || [], response.values || []);
      return;
    }
    let message;
    if (sqlError.message) {
      message = sqlError.message;
    } else if (sqlError.code === 2) {
      message = i18nString(UIStrings.databaseNoLongerHasExpected);
    } else {
      message = i18nString(UIStrings.anUnexpectedErrorSOccurred, { PH1: sqlError.code });
    }
    onError(message);
  }
}
export class DatabaseModel extends SDK.SDKModel.SDKModel {
  databasesInternal;
  agent;
  enabled;
  constructor(target) {
    super(target);
    this.databasesInternal = [];
    this.agent = target.databaseAgent();
    this.target().registerDatabaseDispatcher(new DatabaseDispatcher(this));
  }
  enable() {
    if (this.enabled) {
      return;
    }
    void this.agent.invoke_enable();
    this.enabled = true;
  }
  disable() {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    this.databasesInternal = [];
    void this.agent.invoke_disable();
    this.dispatchEventToListeners(Events.DatabasesRemoved);
  }
  databases() {
    const result = [];
    for (const database of this.databasesInternal) {
      result.push(database);
    }
    return result;
  }
  addDatabase(database) {
    this.databasesInternal.push(database);
    this.dispatchEventToListeners(Events.DatabaseAdded, database);
  }
}
SDK.SDKModel.SDKModel.register(DatabaseModel, { capabilities: SDK.Target.Capability.DOM, autostart: false });
export var Events = /* @__PURE__ */ ((Events2) => {
  Events2["DatabaseAdded"] = "DatabaseAdded";
  Events2["DatabasesRemoved"] = "DatabasesRemoved";
  return Events2;
})(Events || {});
export class DatabaseDispatcher {
  model;
  constructor(model) {
    this.model = model;
  }
  addDatabase({ database }) {
    this.model.addDatabase(new Database(this.model, database.id, database.domain, database.name, database.version));
  }
}
//# sourceMappingURL=DatabaseModel.js.map
