import * as MainModule from "./main.js";
self.Main = self.Main || {};
Main = Main || {};
Main.ExecutionContextSelector = MainModule.ExecutionContextSelector.ExecutionContextSelector;
Main.Main = MainModule.MainImpl.MainImpl;
Main.Main.ZoomActionDelegate = MainModule.MainImpl.ZoomActionDelegate;
Main.Main.SearchActionDelegate = MainModule.MainImpl.SearchActionDelegate;
Main.Main.MainMenuItem = MainModule.MainImpl.MainMenuItem;
Main.Main.SettingsButtonProvider = MainModule.MainImpl.SettingsButtonProvider;
Main.ReloadActionDelegate = MainModule.MainImpl.ReloadActionDelegate;
Main.SimpleApp = MainModule.SimpleApp.SimpleApp;
Main.SimpleAppProvider = MainModule.SimpleApp.SimpleAppProvider;
//# sourceMappingURL=main-legacy.js.map
