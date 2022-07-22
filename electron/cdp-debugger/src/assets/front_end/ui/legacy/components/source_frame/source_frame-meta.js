import * as Common from "../../../../core/common/common.js";
import * as i18n from "../../../../core/i18n/i18n.js";
const UIStrings = {
  defaultIndentation: "Default indentation:",
  setIndentationToSpaces: "Set indentation to 2 spaces",
  Spaces: "2 spaces",
  setIndentationToFSpaces: "Set indentation to 4 spaces",
  fSpaces: "4 spaces",
  setIndentationToESpaces: "Set indentation to 8 spaces",
  eSpaces: "8 spaces",
  setIndentationToTabCharacter: "Set indentation to tab character",
  tabCharacter: "Tab character"
};
const str_ = i18n.i18n.registerUIStrings("ui/legacy/components/source_frame/source_frame-meta.ts", UIStrings);
const i18nLazyString = i18n.i18n.getLazilyComputedLocalizedString.bind(void 0, str_);
Common.Settings.registerSettingExtension({
  category: Common.Settings.SettingCategory.SOURCES,
  storageType: Common.Settings.SettingStorageType.Synced,
  title: i18nLazyString(UIStrings.defaultIndentation),
  settingName: "textEditorIndent",
  settingType: Common.Settings.SettingType.ENUM,
  defaultValue: "    ",
  options: [
    {
      title: i18nLazyString(UIStrings.setIndentationToSpaces),
      text: i18nLazyString(UIStrings.Spaces),
      value: "  "
    },
    {
      title: i18nLazyString(UIStrings.setIndentationToFSpaces),
      text: i18nLazyString(UIStrings.fSpaces),
      value: "    "
    },
    {
      title: i18nLazyString(UIStrings.setIndentationToESpaces),
      text: i18nLazyString(UIStrings.eSpaces),
      value: "        "
    },
    {
      title: i18nLazyString(UIStrings.setIndentationToTabCharacter),
      text: i18nLazyString(UIStrings.tabCharacter),
      value: "	"
    }
  ]
});
//# sourceMappingURL=source_frame-meta.js.map
