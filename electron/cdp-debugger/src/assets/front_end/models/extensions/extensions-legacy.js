import * as ExtensionsModule from "./extensions.js";
self.Extensions = self.Extensions || {};
Extensions = Extensions || {};
Extensions.ExtensionSidebarPane = ExtensionsModule.ExtensionPanel.ExtensionSidebarPane;
Extensions.ExtensionServer = ExtensionsModule.ExtensionServer.ExtensionServer;
Extensions.ExtensionServer.Events = ExtensionsModule.ExtensionServer.Events;
Extensions.ExtensionStatus = ExtensionsModule.ExtensionServer.ExtensionStatus;
Extensions.ExtensionTraceProvider = ExtensionsModule.ExtensionTraceProvider.ExtensionTraceProvider;
Extensions.TracingSession = ExtensionsModule.ExtensionTraceProvider.TracingSession;
//# sourceMappingURL=extensions-legacy.js.map
