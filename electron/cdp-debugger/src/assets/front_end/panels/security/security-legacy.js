import * as SecurityModule from "./security.js";
self.Security = self.Security || {};
Security = Security || {};
Security.SecurityModel = SecurityModule.SecurityModel.SecurityModel;
Security.SecurityModel.Events = SecurityModule.SecurityModel.Events;
Security.PageVisibleSecurityState = SecurityModule.SecurityModel.PageVisibleSecurityState;
Security.CertificateSecurityState = SecurityModule.SecurityModel.CertificateSecurityState;
Security.SecurityStyleExplanation = SecurityModule.SecurityModel.SecurityStyleExplanation;
Security.SecurityPanel = SecurityModule.SecurityPanel.SecurityPanel;
Security.SecurityPanelSidebarTree = SecurityModule.SecurityPanel.SecurityPanelSidebarTree;
Security.SecurityPanelSidebarTree.OriginGroup = SecurityModule.SecurityPanel.OriginGroup;
Security.SecurityPanelSidebarTreeElement = SecurityModule.SecurityPanel.SecurityPanelSidebarTreeElement;
Security.SecurityOriginView = SecurityModule.SecurityPanel.SecurityOriginView;
//# sourceMappingURL=security-legacy.js.map
