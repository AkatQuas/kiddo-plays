#include "QtBridgeApp.h"

QtBridgeApp::QtBridgeApp()
    : v8_(new QtBridgeV8Handler)
{
}

void QtBridgeApp::OnBeforeCommandLineProcessing(const CefString &process_type,
                                                CefRefPtr<CefCommandLine> command_line)
{
    (void)process_type;
    (void)command_line;
}

void QtBridgeApp::OnContextCreated(CefRefPtr<CefBrowser> browser,
                                   CefRefPtr<CefFrame> frame,
                                   CefRefPtr<CefV8Context> context)
{
    (void)frame;
    CefRefPtr<CefV8Value> global = context->GetGlobal();
    v8_->browser = browser;
    CefRefPtr<CefV8Value> func = CefV8Value::CreateFunction("QtBridge", v8_);
    global->SetValue("QtBridge", func, V8_PROPERTY_ATTRIBUTE_NONE);
}
