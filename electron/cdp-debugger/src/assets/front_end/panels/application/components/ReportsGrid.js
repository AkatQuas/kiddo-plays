import * as i18n from "../../../core/i18n/i18n.js";
import * as DataGrid from "../../../ui/components/data_grid/data_grid.js";
import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as IconButton from "../../../ui/components/icon_button/icon_button.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import * as Root from "../../../core/root/root.js";
import reportingApiGridStyles from "./reportingApiGrid.css.js";
const UIStrings = {
  noReportsToDisplay: "No reports to display",
  status: "Status",
  destination: "Destination",
  generatedAt: "Generated at"
};
const str_ = i18n.i18n.registerUIStrings("panels/application/components/ReportsGrid.ts", UIStrings);
export const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
const { render, html } = LitHtml;
export class ReportsGridStatusHeader extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-resources-reports-grid-status-header`;
  #shadow = this.attachShadow({ mode: "open" });
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [reportingApiGridStyles];
    this.#render();
  }
  #render() {
    render(html`
      ${i18nString(UIStrings.status)}
      <x-link href="https://web.dev/reporting-api/#report-status">
        <${IconButton.Icon.Icon.litTagName} class="inline-icon" .data=${{
      iconName: "help_outline",
      color: "var(--color-primary)",
      width: "16px",
      height: "16px"
    }}></${IconButton.Icon.Icon.litTagName}>
      </x-link>
    `, this.#shadow, { host: this });
  }
}
export class ReportsGrid extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-resources-reports-grid`;
  #shadow = this.attachShadow({ mode: "open" });
  #reports = [];
  #protocolMonitorExperimentEnabled = false;
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [reportingApiGridStyles];
    this.#protocolMonitorExperimentEnabled = Root.Runtime.experiments.isEnabled("protocolMonitor");
    this.#render();
  }
  set data(data) {
    this.#reports = data.reports;
    this.#render();
  }
  #render() {
    const reportsGridData = {
      columns: [
        {
          id: "url",
          title: i18n.i18n.lockedString("URL"),
          widthWeighting: 30,
          hideable: false,
          visible: true
        },
        {
          id: "type",
          title: i18n.i18n.lockedString("Type"),
          widthWeighting: 20,
          hideable: false,
          visible: true
        },
        {
          id: "status",
          title: i18nString(UIStrings.status),
          widthWeighting: 20,
          hideable: false,
          visible: true,
          titleElement: html`
          <${ReportsGridStatusHeader.litTagName}></${ReportsGridStatusHeader.litTagName}>
          `
        },
        {
          id: "destination",
          title: i18nString(UIStrings.destination),
          widthWeighting: 20,
          hideable: false,
          visible: true
        },
        {
          id: "timestamp",
          title: i18nString(UIStrings.generatedAt),
          widthWeighting: 20,
          hideable: false,
          visible: true
        },
        {
          id: "body",
          title: i18n.i18n.lockedString("Body"),
          widthWeighting: 20,
          hideable: false,
          visible: true
        }
      ],
      rows: this.#buildReportRows()
    };
    if (this.#protocolMonitorExperimentEnabled) {
      reportsGridData.columns.unshift({ id: "id", title: "ID", widthWeighting: 30, hideable: false, visible: true });
    }
    render(html`
      <div class="reporting-container">
        <div class="reporting-header">${i18n.i18n.lockedString("Reports")}</div>
        ${this.#reports.length > 0 ? html`
          <${DataGrid.DataGridController.DataGridController.litTagName} .data=${reportsGridData}>
          </${DataGrid.DataGridController.DataGridController.litTagName}>
        ` : html`
          <div class="reporting-placeholder">
            <div>${i18nString(UIStrings.noReportsToDisplay)}</div>
          </div>
        `}
      </div>
    `, this.#shadow, { host: this });
  }
  #buildReportRows() {
    return this.#reports.map((report) => ({
      cells: [
        { columnId: "id", value: report.id },
        { columnId: "url", value: report.initiatorUrl },
        { columnId: "type", value: report.type },
        { columnId: "status", value: report.status },
        { columnId: "destination", value: report.destination },
        { columnId: "timestamp", value: new Date(report.timestamp * 1e3).toLocaleString() },
        { columnId: "body", value: JSON.stringify(report.body) }
      ]
    }));
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-resources-reports-grid-status-header", ReportsGridStatusHeader);
ComponentHelpers.CustomElements.defineComponent("devtools-resources-reports-grid", ReportsGrid);
//# sourceMappingURL=ReportsGrid.js.map
