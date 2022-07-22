import * as i18n from "../../../core/i18n/i18n.js";
import * as DataGrid from "../../../ui/components/data_grid/data_grid.js";
import * as ComponentHelpers from "../../../ui/components/helpers/helpers.js";
import * as IconButton from "../../../ui/components/icon_button/icon_button.js";
import * as LitHtml from "../../../ui/lit-html/lit-html.js";
import interestGroupAccessGridStyles from "./interestGroupAccessGrid.css.js";
const UIStrings = {
  allInterestGroupStorageEvents: "All interest group storage events.",
  eventTime: "Event Time",
  eventType: "Access Type",
  groupOwner: "Owner",
  groupName: "Name",
  noEvents: "No interest group events recorded."
};
const str_ = i18n.i18n.registerUIStrings("panels/application/components/InterestGroupAccessGrid.ts", UIStrings);
export const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class InterestGroupAccessGrid extends HTMLElement {
  static litTagName = LitHtml.literal`devtools-interest-group-access-grid`;
  #shadow = this.attachShadow({ mode: "open" });
  #datastores = [];
  connectedCallback() {
    this.#shadow.adoptedStyleSheets = [interestGroupAccessGridStyles];
    this.#render();
  }
  set data(data) {
    this.#datastores = data;
    this.#render();
  }
  #render() {
    LitHtml.render(LitHtml.html`
      <div>
        <span class="heading">Interest Groups</span>
        <${IconButton.Icon.Icon.litTagName} class="info-icon" title=${i18nString(UIStrings.allInterestGroupStorageEvents)}
          .data=${{ iconName: "ic_info_black_18dp", color: "var(--color-link)", width: "14px" }}>
        </${IconButton.Icon.Icon.litTagName}>
        ${this.#renderGridOrNoDataMessage()}
      </div>
    `, this.#shadow, { host: this });
  }
  #renderGridOrNoDataMessage() {
    if (this.#datastores.length === 0) {
      return LitHtml.html`<div class="no-events-message">${i18nString(UIStrings.noEvents)}</div>`;
    }
    const gridData = {
      columns: [
        {
          id: "event-time",
          title: i18nString(UIStrings.eventTime),
          widthWeighting: 10,
          hideable: false,
          visible: true,
          sortable: true
        },
        {
          id: "event-type",
          title: i18nString(UIStrings.eventType),
          widthWeighting: 5,
          hideable: false,
          visible: true,
          sortable: true
        },
        {
          id: "event-group-owner",
          title: i18nString(UIStrings.groupOwner),
          widthWeighting: 10,
          hideable: false,
          visible: true,
          sortable: true
        },
        {
          id: "event-group-name",
          title: i18nString(UIStrings.groupName),
          widthWeighting: 10,
          hideable: false,
          visible: true,
          sortable: true
        }
      ],
      rows: this.#buildRows(),
      initialSort: {
        columnId: "event-time",
        direction: DataGrid.DataGridUtils.SortDirection.ASC
      }
    };
    return LitHtml.html`
      <${DataGrid.DataGridController.DataGridController.litTagName} .data=${gridData}></${DataGrid.DataGridController.DataGridController.litTagName}>
    `;
  }
  #buildRows() {
    return this.#datastores.map((event) => ({
      cells: [
        {
          columnId: "event-time",
          value: event.accessTime,
          renderer: this.#renderDateForDataGridCell.bind(this)
        },
        { columnId: "event-type", value: event.type },
        { columnId: "event-group-owner", value: event.ownerOrigin },
        { columnId: "event-group-name", value: event.name }
      ]
    }));
  }
  #renderDateForDataGridCell(value) {
    const date = new Date(1e3 * value);
    return LitHtml.html`${date.toLocaleString()}`;
  }
}
ComponentHelpers.CustomElements.defineComponent("devtools-interest-group-access-grid", InterestGroupAccessGrid);
//# sourceMappingURL=InterestGroupAccessGrid.js.map
