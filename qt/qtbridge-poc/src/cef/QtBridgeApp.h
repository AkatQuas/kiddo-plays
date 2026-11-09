#pragma once

#include "include/cef_app.h"
#include "QtBridgeV8Handler.h"

/**
 * Shared CefApp for browser + render processes.
 * Render side injects window.QtBridge into each V8 context.
 */
class QtBridgeApp : public CefApp,
                    public CefBrowserProcessHandler,
                    public CefRenderProcessHandler {
public:
    QtBridgeApp();

    CefRefPtr<CefBrowserProcessHandler> GetBrowserProcessHandler() override { return this; }
    CefRefPtr<CefRenderProcessHandler> GetRenderProcessHandler() override { return this; }

    void OnBeforeCommandLineProcessing(const CefString &process_type,
                                       CefRefPtr<CefCommandLine> command_line) override;

    void OnContextCreated(CefRefPtr<CefBrowser> browser,
                          CefRefPtr<CefFrame> frame,
                          CefRefPtr<CefV8Context> context) override;

private:
    CefRefPtr<QtBridgeV8Handler> v8_;
    IMPLEMENT_REFCOUNTING(QtBridgeApp);
};
