import * as i18n from "../../core/i18n/i18n.js";
import { ColdColorScheme, HotColorScheme, TickingFlameChart } from "./TickingFlameChart.js";
const NO_NORMALIZED_TIMESTAMP = -1.5;
const UIStrings = {
  playbackStatus: "Playback Status",
  bufferingStatus: "Buffering Status"
};
const str_ = i18n.i18n.registerUIStrings("panels/media/EventTimelineView.ts", UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(void 0, str_);
export class PlayerEventsTimeline extends TickingFlameChart {
  normalizedTimestamp;
  playbackStatusLastEvent;
  audioBufferingStateEvent;
  videoBufferingStateEvent;
  constructor() {
    super();
    this.normalizedTimestamp = NO_NORMALIZED_TIMESTAMP;
    this.addGroup(i18nString(UIStrings.playbackStatus), 2);
    this.addGroup(i18nString(UIStrings.bufferingStatus), 2);
    this.playbackStatusLastEvent = null;
    this.audioBufferingStateEvent = null;
    this.videoBufferingStateEvent = null;
  }
  ensureNoPreviousPlaybackEvent(normalizedTime) {
    if (this.playbackStatusLastEvent !== null) {
      this.playbackStatusLastEvent.endTime = normalizedTime;
      this.playbackStatusLastEvent = null;
    }
  }
  onPlaybackEvent(event, normalizedTime) {
    switch (event.event) {
      case "kPlay":
        this.canTick = true;
        this.ensureNoPreviousPlaybackEvent(normalizedTime);
        this.playbackStatusLastEvent = this.startEvent({
          level: 0,
          startTime: normalizedTime,
          name: "Play"
        });
        break;
      case "kPause":
        this.ensureNoPreviousPlaybackEvent(normalizedTime);
        this.playbackStatusLastEvent = this.startEvent({
          level: 0,
          startTime: normalizedTime,
          name: "Pause",
          color: HotColorScheme[1]
        });
        break;
      case "kWebMediaPlayerDestroyed":
        this.canTick = false;
        this.ensureNoPreviousPlaybackEvent(normalizedTime);
        this.addMarker({
          level: 1,
          startTime: normalizedTime,
          name: "Destroyed",
          color: HotColorScheme[4]
        });
        break;
      case "kSuspended":
        this.canTick = false;
        this.ensureNoPreviousPlaybackEvent(normalizedTime);
        this.playbackStatusLastEvent = this.startEvent({
          level: 1,
          startTime: normalizedTime,
          name: "Suspended",
          color: HotColorScheme[3]
        });
        break;
      case "kEnded":
        this.ensureNoPreviousPlaybackEvent(normalizedTime);
        this.playbackStatusLastEvent = this.startEvent({
          level: 1,
          startTime: normalizedTime,
          name: "Ended",
          color: HotColorScheme[2]
        });
        break;
      default:
        throw `_onPlaybackEvent cant handle ${event.event}`;
    }
  }
  bufferedEnough(state) {
    return state["state"] === "BUFFERING_HAVE_ENOUGH";
  }
  onBufferingStatus(event, normalizedTime) {
    let audioState = null;
    let videoState = null;
    switch (event.event) {
      case "kBufferingStateChanged":
        audioState = event.value["audio_buffering_state"];
        videoState = event.value["video_buffering_state"];
        if (audioState) {
          if (this.audioBufferingStateEvent !== null) {
            this.audioBufferingStateEvent.endTime = normalizedTime;
            this.audioBufferingStateEvent = null;
          }
          if (!this.bufferedEnough(audioState)) {
            this.audioBufferingStateEvent = this.startEvent({
              level: 3,
              startTime: normalizedTime,
              name: "Audio Buffering",
              color: ColdColorScheme[1]
            });
          }
        }
        if (videoState) {
          if (this.videoBufferingStateEvent !== null) {
            this.videoBufferingStateEvent.endTime = normalizedTime;
            this.videoBufferingStateEvent = null;
          }
          if (!this.bufferedEnough(videoState)) {
            this.videoBufferingStateEvent = this.startEvent({
              level: 2,
              startTime: normalizedTime,
              name: "Video Buffering",
              color: ColdColorScheme[0]
            });
          }
        }
        break;
      default:
        throw `_onPlaybackEvent cant handle ${event.event}`;
    }
  }
  onEvent(event) {
    if (this.normalizedTimestamp === NO_NORMALIZED_TIMESTAMP) {
      this.normalizedTimestamp = Number(event.timestamp);
    }
    const inMilliseconds = (Number(event.timestamp) - this.normalizedTimestamp) * 1e3;
    switch (event.event) {
      case "kPlay":
      case "kPause":
      case "kWebMediaPlayerDestroyed":
      case "kSuspended":
      case "kEnded":
        return this.onPlaybackEvent(event, inMilliseconds);
      case "kBufferingStateChanged":
        return this.onBufferingStatus(event, inMilliseconds);
      default:
    }
  }
}
//# sourceMappingURL=EventTimelineView.js.map
