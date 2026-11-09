#include "cef/QtBridgeApp.h"

#include "include/cef_app.h"

#if defined(OS_WIN) || defined(_WIN32)
#include <windows.h>
#endif

int main(int argc, char *argv[])
{
    CefMainArgs main_args
#if defined(_WIN32)
        (GetModuleHandle(nullptr));
    (void)argc;
    (void)argv;
#else
        (argc, argv);
#endif

    CefRefPtr<QtBridgeApp> app(new QtBridgeApp);
    return CefExecuteProcess(main_args, app, nullptr);
}
