import * as i18n from "../../core/i18n/i18n.js";
import * as SDK from "../../core/sdk/sdk.js";
import * as Protocol from "../../generated/protocol.js";
import * as UI from "../../ui/legacy/legacy.js";
const UIStrings = {
  version: "Version",
  updateActivity: "Update Activity",
  timeline: "Timeline",
  startTimeS: "Start time: {PH1}",
  endTimeS: "End time: {PH1}"
};
const str_ = i18n.i18n.registerUIStrings("panels/application/ServiceWorkerUpdateCycleView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class ServiceWorkerUpdateCycleView {
  registration;
  rows;
  selectedRowIndex;
  tableElement;
  constructor(registration) {
    this.registration = registration;
    this.rows = [];
    this.selectedRowIndex = -1;
    this.tableElement = document.createElement("table");
    this.createTimingTable();
  }
  calculateServiceWorkerUpdateRanges() {
    function addRange(ranges, range) {
      if (range.start < Number.MAX_VALUE && range.start <= range.end) {
        ranges.push(range);
      }
    }
    function addNormalizedRanges(ranges, id, startInstallTime, endInstallTime, startActivateTime, endActivateTime, status) {
      addRange(ranges, { id, phase: ServiceWorkerUpdateNames.Install, start: startInstallTime, end: endInstallTime });
      if (status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Activating || status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Activated || status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Redundant) {
        addRange(ranges, {
          id,
          phase: ServiceWorkerUpdateNames.Wait,
          start: endInstallTime,
          end: startActivateTime
        });
        addRange(ranges, { id, phase: ServiceWorkerUpdateNames.Activate, start: startActivateTime, end: endActivateTime });
      }
    }
    function rangesForVersion(version) {
      let state = version.currentState;
      let endActivateTime = 0;
      let beginActivateTime = 0;
      let endInstallTime = 0;
      let beginInstallTime = 0;
      const currentStatus = state.status;
      if (currentStatus === Protocol.ServiceWorker.ServiceWorkerVersionStatus.New) {
        return [];
      }
      while (state) {
        if (state.status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Activated) {
          endActivateTime = state.last_updated_timestamp;
        } else if (state.status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Activating) {
          if (endActivateTime === 0) {
            endActivateTime = state.last_updated_timestamp;
          }
          beginActivateTime = state.last_updated_timestamp;
        } else if (state.status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Installed) {
          endInstallTime = state.last_updated_timestamp;
        } else if (state.status === Protocol.ServiceWorker.ServiceWorkerVersionStatus.Installing) {
          if (endInstallTime === 0) {
            endInstallTime = state.last_updated_timestamp;
          }
          beginInstallTime = state.last_updated_timestamp;
        }
        state = state.previousState;
      }
      const ranges = [];
      addNormalizedRanges(ranges, version.id, beginInstallTime, endInstallTime, beginActivateTime, endActivateTime, currentStatus);
      return ranges;
    }
    const versions = this.registration.versionsByMode();
    const modes = [
      SDK.ServiceWorkerManager.ServiceWorkerVersion.Modes.Active,
      SDK.ServiceWorkerManager.ServiceWorkerVersion.Modes.Waiting,
      SDK.ServiceWorkerManager.ServiceWorkerVersion.Modes.Installing,
      SDK.ServiceWorkerManager.ServiceWorkerVersion.Modes.Redundant
    ];
    for (const mode of modes) {
      const version = versions.get(mode);
      if (version) {
        const ranges = rangesForVersion(version);
        return ranges;
      }
    }
    return [];
  }
  createTimingTable() {
    this.tableElement.classList.add("service-worker-update-timing-table");
    const timeRanges = this.calculateServiceWorkerUpdateRanges();
    this.updateTimingTable(timeRanges);
  }
  createTimingTableHead() {
    const serverHeader = this.tableElement.createChild("tr", "service-worker-update-timing-table-header");
    UI.UIUtils.createTextChild(serverHeader.createChild("td"), i18nString(UIStrings.version));
    UI.UIUtils.createTextChild(serverHeader.createChild("td"), i18nString(UIStrings.updateActivity));
    UI.UIUtils.createTextChild(serverHeader.createChild("td"), i18nString(UIStrings.timeline));
  }
  removeRows() {
    const rows = this.tableElement.getElementsByTagName("tr");
    while (rows[0]) {
      if (rows[0].parentNode) {
        rows[0].parentNode.removeChild(rows[0]);
      }
    }
    this.rows = [];
  }
  updateTimingTable(timeRanges) {
    this.selectedRowIndex = -1;
    this.removeRows();
    this.createTimingTableHead();
    const timeRangeArray = timeRanges;
    if (timeRangeArray.length === 0) {
      return;
    }
    const startTimes = timeRangeArray.map((r) => r.start);
    const endTimes = timeRangeArray.map((r) => r.end);
    const startTime = startTimes.reduce((a, b) => Math.min(a, b));
    const endTime = endTimes.reduce((a, b) => Math.max(a, b));
    const scale = 100 / (endTime - startTime);
    for (const range of timeRangeArray) {
      const phaseName = range.phase;
      const left = scale * (range.start - startTime);
      const right = scale * (endTime - range.end);
      const tr = this.tableElement.createChild("tr", "service-worker-update-timeline");
      this.rows.push(tr);
      const timingBarVersionElement = tr.createChild("td");
      UI.UIUtils.createTextChild(timingBarVersionElement, "#" + range.id);
      timingBarVersionElement.classList.add("service-worker-update-timing-bar-clickable");
      timingBarVersionElement.setAttribute("tabindex", "0");
      timingBarVersionElement.setAttribute("role", "switch");
      timingBarVersionElement.addEventListener("focus", (event) => {
        this.onFocus(event);
      });
      UI.ARIAUtils.setChecked(timingBarVersionElement, false);
      const timingBarTitleElement = tr.createChild("td");
      UI.UIUtils.createTextChild(timingBarTitleElement, phaseName);
      const barContainer = tr.createChild("td").createChild("div", "service-worker-update-timing-row");
      const bar = barContainer.createChild("span", "service-worker-update-timing-bar " + phaseName.toLowerCase());
      bar.style.left = left + "%";
      bar.style.right = right + "%";
      bar.textContent = "\u200B";
      this.constructUpdateDetails(tr, range);
    }
  }
  constructUpdateDetails(tr, range) {
    const startRow = this.tableElement.createChild("tr", "service-worker-update-timing-bar-details");
    startRow.classList.add("service-worker-update-timing-bar-details-collapsed");
    const startTimeItem = startRow.createChild("td");
    startTimeItem.colSpan = 3;
    const startTime = new Date(range.start).toISOString();
    UI.UIUtils.createTextChild(startTimeItem.createChild("span"), i18nString(UIStrings.startTimeS, { PH1: startTime }));
    startRow.tabIndex = 0;
    const endRow = this.tableElement.createChild("tr", "service-worker-update-timing-bar-details");
    endRow.classList.add("service-worker-update-timing-bar-details-collapsed");
    const endTimeItem = endRow.createChild("td");
    endTimeItem.colSpan = 3;
    const endTime = new Date(range.end).toISOString();
    UI.UIUtils.createTextChild(endTimeItem.createChild("span"), i18nString(UIStrings.endTimeS, { PH1: endTime }));
    endRow.tabIndex = 0;
    tr.addEventListener("keydown", (event) => {
      this.onKeydown(event, startRow, endRow);
    });
    tr.addEventListener("click", (event) => {
      this.onClick(event, startRow, endRow);
    });
  }
  toggle(startRow, endRow, target, expanded) {
    if (target.classList.contains("service-worker-update-timing-bar-clickable")) {
      startRow.classList.toggle("service-worker-update-timing-bar-details-collapsed");
      startRow.classList.toggle("service-worker-update-timing-bar-details-expanded");
      endRow.classList.toggle("service-worker-update-timing-bar-details-collapsed");
      endRow.classList.toggle("service-worker-update-timing-bar-details-expanded");
      UI.ARIAUtils.setChecked(target, !expanded);
    }
  }
  onFocus(event) {
    const target = event.target;
    if (!target) {
      return;
    }
    const tr = target.parentElement;
    if (!tr) {
      return;
    }
    this.selectedRowIndex = this.rows.indexOf(tr);
  }
  onKeydown(event, startRow, endRow) {
    if (!event.target) {
      return;
    }
    const target = event.target;
    const keyboardEvent = event;
    const expanded = target.getAttribute("aria-checked") === "true";
    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      this.toggle(startRow, endRow, target, expanded);
      event.preventDefault();
      return;
    }
    if (!expanded && keyboardEvent.key === "ArrowRight" || expanded && keyboardEvent.key === "ArrowLeft") {
      this.toggle(startRow, endRow, target, expanded);
      event.preventDefault();
      return;
    }
    if (keyboardEvent.key === "ArrowDown") {
      if (this.selectedRowIndex >= 0) {
        this.selectNextRow();
      } else {
        this.selectFirstRow();
      }
      event.preventDefault();
    }
    if (keyboardEvent.key === "ArrowUp") {
      if (this.selectedRowIndex >= 0) {
        this.selectPreviousRow();
      } else {
        this.selectLastRow();
      }
      event.preventDefault();
    }
  }
  focusRow(row) {
    row.cells[0].focus();
  }
  blurRow(row) {
    row.cells[0].blur();
  }
  selectFirstRow() {
    if (this.rows.length === 0) {
      return;
    }
    this.selectedRowIndex = 0;
    this.focusRow(this.rows[0]);
  }
  selectLastRow() {
    if (this.rows.length === 0) {
      return;
    }
    this.selectedRowIndex = this.rows.length - 1;
    this.focusRow(this.rows[this.selectedRowIndex]);
  }
  selectNextRow() {
    if (this.rows.length === 0) {
      return;
    }
    const previousRowIndex = this.selectedRowIndex;
    this.selectedRowIndex++;
    if (this.selectedRowIndex >= this.rows.length) {
      this.selectedRowIndex = 0;
    }
    this.blurRow(this.rows[previousRowIndex]);
    this.focusRow(this.rows[this.selectedRowIndex]);
  }
  selectPreviousRow() {
    if (this.rows.length === 0) {
      return;
    }
    const previousRowIndex = this.selectedRowIndex;
    this.selectedRowIndex--;
    if (this.selectedRowIndex < 0) {
      this.selectedRowIndex = this.rows.length - 1;
    }
    this.blurRow(this.rows[previousRowIndex]);
    this.focusRow(this.rows[this.selectedRowIndex]);
  }
  onClick(event, startRow, endRow) {
    const tr = event.target;
    if (!tr) {
      return;
    }
    const expanded = tr.getAttribute("aria-checked") === "true";
    this.toggle(startRow, endRow, tr, expanded);
    event.preventDefault();
  }
  refresh() {
    const timeRanges = this.calculateServiceWorkerUpdateRanges();
    this.updateTimingTable(timeRanges);
  }
}
export var ServiceWorkerUpdateNames = /* @__PURE__ */ ((ServiceWorkerUpdateNames2) => {
  ServiceWorkerUpdateNames2["Install"] = "Install";
  ServiceWorkerUpdateNames2["Wait"] = "Wait";
  ServiceWorkerUpdateNames2["Activate"] = "Activate";
  return ServiceWorkerUpdateNames2;
})(ServiceWorkerUpdateNames || {});
//# sourceMappingURL=ServiceWorkerUpdateCycleView.js.map
