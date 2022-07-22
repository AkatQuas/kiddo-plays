import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import { PlayerEventsView } from "./EventDisplayTable.js";
import { PlayerEventsTimeline } from "./EventTimelineView.js";
import { PlayerMessagesView } from "./PlayerMessagesView.js";
import { PlayerPropertiesView } from "./PlayerPropertiesView.js";
const UIStrings = {
  properties: "Properties",
  playerProperties: "Player properties",
  events: "Events",
  playerEvents: "Player events",
  messages: "Messages",
  playerMessages: "Player messages",
  timeline: "Timeline",
  playerTimeline: "Player timeline"
};
const str_ = i18n.i18n.registerUIStrings("panels/media/PlayerDetailView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export var PlayerDetailViewTabs = /* @__PURE__ */ ((PlayerDetailViewTabs2) => {
  PlayerDetailViewTabs2["Events"] = "events";
  PlayerDetailViewTabs2["Properties"] = "properties";
  PlayerDetailViewTabs2["Messages"] = "messages";
  PlayerDetailViewTabs2["Timeline"] = "timeline";
  return PlayerDetailViewTabs2;
})(PlayerDetailViewTabs || {});
export class PlayerDetailView extends UI.TabbedPane.TabbedPane {
  eventView;
  propertyView;
  messageView;
  timelineView;
  constructor() {
    super();
    this.eventView = new PlayerEventsView();
    this.propertyView = new PlayerPropertiesView();
    this.messageView = new PlayerMessagesView();
    this.timelineView = new PlayerEventsTimeline();
    this.appendTab("properties" /* Properties */, i18nString(UIStrings.properties), this.propertyView, i18nString(UIStrings.playerProperties));
    this.appendTab("events" /* Events */, i18nString(UIStrings.events), this.eventView, i18nString(UIStrings.playerEvents));
    this.appendTab("messages" /* Messages */, i18nString(UIStrings.messages), this.messageView, i18nString(UIStrings.playerMessages));
    this.appendTab("timeline" /* Timeline */, i18nString(UIStrings.timeline), this.timelineView, i18nString(UIStrings.playerTimeline));
  }
  onProperty(property) {
    this.propertyView.onProperty(property);
  }
  onError(_error) {
  }
  onMessage(message) {
    this.messageView.addMessage(message);
  }
  onEvent(event) {
    this.eventView.onEvent(event);
    this.timelineView.onEvent(event);
  }
}
//# sourceMappingURL=PlayerDetailView.js.map
