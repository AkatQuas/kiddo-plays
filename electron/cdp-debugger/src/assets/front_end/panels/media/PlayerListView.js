import * as i18n from "../../core/i18n/i18n.js";
import * as UI from "../../ui/legacy/legacy.js";
import playerListViewStyles from "./playerListView.css.js";
import { PlayerPropertyKeys } from "./PlayerPropertiesView.js";
const UIStrings = {
  hidePlayer: "Hide player",
  hideAllOthers: "Hide all others",
  savePlayerInfo: "Save player info",
  players: "Players"
};
const str_ = i18n.i18n.registerUIStrings("panels/media/PlayerListView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class PlayerListView extends UI.Widget.VBox {
  playerEntryFragments;
  playerEntriesWithHostnameFrameTitle;
  mainContainer;
  currentlySelectedEntry;
  constructor(mainContainer) {
    super(true);
    this.playerEntryFragments = /* @__PURE__ */ new Map();
    this.playerEntriesWithHostnameFrameTitle = /* @__PURE__ */ new Set();
    this.mainContainer = mainContainer;
    this.currentlySelectedEntry = null;
    this.contentElement.createChild("div", "player-entry-header").textContent = i18nString(UIStrings.players);
  }
  createPlayerListEntry(playerID) {
    const entry = UI.Fragment.Fragment.build`
    <div class="player-entry-row hbox">
    <div class="player-entry-status-icon vbox">
    <div $="icon" class="player-entry-status-icon-centering"></div>
    </div>
    <div $="frame-title" class="player-entry-frame-title">FrameTitle</div>
    <div $="player-title" class="player-entry-player-title">PlayerTitle</div>
    </div>
    `;
    const element = entry.element();
    element.addEventListener("click", this.selectPlayer.bind(this, playerID, element));
    element.addEventListener("contextmenu", this.rightClickPlayer.bind(this, playerID));
    entry.$("icon").appendChild(UI.Icon.Icon.create("largeicon-pause-animation", "media-player"));
    return entry;
  }
  selectPlayer(playerID, element) {
    this.mainContainer.renderMainPanel(playerID);
    if (this.currentlySelectedEntry !== null) {
      this.currentlySelectedEntry.classList.remove("selected");
      this.currentlySelectedEntry.classList.remove("force-white-icons");
    }
    element.classList.add("selected");
    element.classList.add("force-white-icons");
    this.currentlySelectedEntry = element;
  }
  rightClickPlayer(playerID, event) {
    const contextMenu = new UI.ContextMenu.ContextMenu(event);
    contextMenu.headerSection().appendItem(i18nString(UIStrings.hidePlayer), this.mainContainer.markPlayerForDeletion.bind(this.mainContainer, playerID));
    contextMenu.headerSection().appendItem(i18nString(UIStrings.hideAllOthers), this.mainContainer.markOtherPlayersForDeletion.bind(this.mainContainer, playerID));
    contextMenu.headerSection().appendItem(i18nString(UIStrings.savePlayerInfo), this.mainContainer.exportPlayerData.bind(this.mainContainer, playerID));
    void contextMenu.show();
    return true;
  }
  setMediaElementFrameTitle(playerID, frameTitle, isHostname) {
    if (this.playerEntriesWithHostnameFrameTitle.has(playerID)) {
      if (!isHostname) {
        this.playerEntriesWithHostnameFrameTitle.delete(playerID);
      }
    } else if (isHostname) {
      return;
    }
    if (!this.playerEntryFragments.has(playerID)) {
      return;
    }
    const fragment = this.playerEntryFragments.get(playerID);
    if (fragment === void 0 || fragment.element() === void 0) {
      return;
    }
    fragment.$("frame-title").textContent = frameTitle;
  }
  setMediaElementPlayerTitle(playerID, playerTitle) {
    if (!this.playerEntryFragments.has(playerID)) {
      return;
    }
    const fragment = this.playerEntryFragments.get(playerID);
    if (fragment === void 0) {
      return;
    }
    fragment.$("player-title").textContent = playerTitle;
  }
  setMediaElementPlayerIcon(playerID, iconName) {
    if (!this.playerEntryFragments.has(playerID)) {
      return;
    }
    const fragment = this.playerEntryFragments.get(playerID);
    if (fragment === void 0) {
      return;
    }
    const icon = fragment.$("icon");
    if (icon === void 0) {
      return;
    }
    icon.textContent = "";
    icon.appendChild(UI.Icon.Icon.create(iconName, "media-player"));
  }
  formatAndEvaluate(playerID, func, candidate, min, max) {
    if (candidate.length <= min) {
      return;
    }
    if (candidate.length >= max) {
      candidate = candidate.substring(0, max - 3) + "...";
    }
    func.bind(this)(playerID, candidate);
  }
  addMediaElementItem(playerID) {
    const sidebarEntry = this.createPlayerListEntry(playerID);
    this.contentElement.appendChild(sidebarEntry.element());
    this.playerEntryFragments.set(playerID, sidebarEntry);
    this.playerEntriesWithHostnameFrameTitle.add(playerID);
  }
  deletePlayer(playerID) {
    if (!this.playerEntryFragments.has(playerID)) {
      return;
    }
    const fragment = this.playerEntryFragments.get(playerID);
    if (fragment === void 0 || fragment.element() === void 0) {
      return;
    }
    this.contentElement.removeChild(fragment.element());
    this.playerEntryFragments.delete(playerID);
  }
  onEvent(playerID, event) {
    const parsed = JSON.parse(event.value);
    const eventType = parsed.event;
    if (eventType === "kLoad") {
      const url = parsed.url;
      const videoName = url.substring(url.lastIndexOf("/") + 1);
      this.formatAndEvaluate(playerID, this.setMediaElementPlayerTitle, videoName, 1, 20);
      return;
    }
    if (eventType === "kPlay") {
      this.setMediaElementPlayerIcon(playerID, "largeicon-play-animation");
      return;
    }
    if (eventType === "kPause" || eventType === "kEnded") {
      this.setMediaElementPlayerIcon(playerID, "largeicon-pause-animation");
      return;
    }
    if (eventType === "kWebMediaPlayerDestroyed") {
      this.setMediaElementPlayerIcon(playerID, "smallicon-videoplayer-destroyed");
      return;
    }
  }
  onProperty(playerID, property) {
    if (property.name === PlayerPropertyKeys.FrameUrl) {
      const frameTitle = new URL(property.value).hostname;
      this.formatAndEvaluate(playerID, this.setMediaElementFrameTitle, frameTitle, 1, 20);
      return;
    }
    if (property.name === PlayerPropertyKeys.FrameTitle && property.value) {
      this.formatAndEvaluate(playerID, this.setMediaElementFrameTitle, property.value, 1, 20);
      return;
    }
  }
  onError(_playerID, _error) {
  }
  onMessage(_playerID, _message) {
  }
  wasShown() {
    super.wasShown();
    this.registerCSSFiles([playerListViewStyles]);
  }
}
//# sourceMappingURL=PlayerListView.js.map
