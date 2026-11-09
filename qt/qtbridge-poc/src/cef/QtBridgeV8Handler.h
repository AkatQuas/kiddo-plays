#pragma once

#include "include/cef_v8.h"
#include "include/cef_browser.h"

/** Render-process handler for window.QtBridge(...). */
class QtBridgeV8Handler : public CefV8Handler {
public:
    QtBridgeV8Handler() = default;

    bool Execute(const CefString &name,
                 CefRefPtr<CefV8Value> object,
                 const CefV8ValueList &arguments,
                 CefRefPtr<CefV8Value> &retval,
                 CefString &exception) override;

    CefRefPtr<CefBrowser> browser;

private:
    IMPLEMENT_REFCOUNTING(QtBridgeV8Handler);
};
