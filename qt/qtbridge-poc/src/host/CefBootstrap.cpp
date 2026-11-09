#include "CefBootstrap.h"
#include "../cef/QtBridgeApp.h"

#include "include/cef_app.h"
#include "include/cef_command_line.h"

#include <QApplication>
#include <QCoreApplication>
#include <QDir>
#include <QFileInfo>

#if defined(Q_OS_WIN)
#include <windows.h>
#endif

namespace CefBootstrap {
namespace {

QString resolveHelperPath()
{
#if defined(Q_OS_MAC)
    // Prefer bundled Renderer helper after scripts/bundle-mac.sh.
    const QString appDir = QCoreApplication::applicationDirPath(); // .../Contents/MacOS
    const QString bundled =
        QDir(appDir).absoluteFilePath(
            QStringLiteral("../Frameworks/qtbridge-poc Helper (Renderer).app/Contents/MacOS/qtbridge-poc Helper (Renderer)"));
    if (QFileInfo::exists(bundled)) {
        return bundled;
    }
#endif
    const QStringList candidates = {
        QDir(QCoreApplication::applicationDirPath()).absoluteFilePath(QStringLiteral("qtbridge-helper")),
        QDir(QCoreApplication::applicationDirPath()).absoluteFilePath(QStringLiteral("../helper/qtbridge-helper")),
        QDir(QCoreApplication::applicationDirPath()).absoluteFilePath(QStringLiteral("../../helper/qtbridge-helper")),
    };
    for (const QString &path : candidates) {
        if (QFileInfo::exists(path)) {
            return path;
        }
    }
    return QString();
}

} // namespace

bool init(int argc, char **argv, QApplication &app)
{
    (void)app;
    CefMainArgs main_args
#if defined(Q_OS_WIN)
        (GetModuleHandle(nullptr));
    (void)argc;
    (void)argv;
#else
        (argc, argv);
#endif

    CefRefPtr<QtBridgeApp> cef_app(new QtBridgeApp);

    const int code = CefExecuteProcess(main_args, cef_app, nullptr);
    if (code >= 0) {
        return false;
    }

    CefSettings settings;
    settings.no_sandbox = true;
    settings.multi_threaded_message_loop = false;
    settings.external_message_pump = true;
#if !defined(NDEBUG)
    settings.log_severity = LOGSEVERITY_INFO;
#else
    settings.log_severity = LOGSEVERITY_WARNING;
#endif

    const QString helper = resolveHelperPath();
    if (!helper.isEmpty()) {
        CefString(&settings.browser_subprocess_path).FromString(helper.toStdString());
    }

    const QByteArray cache =
        QDir::temp().absoluteFilePath(QStringLiteral("qtbridge-poc-cef")).toUtf8();
    CefString(&settings.cache_path).FromString(cache.constData());

    if (!CefInitialize(main_args, settings, cef_app, nullptr)) {
        return false;
    }
    return true;
}

void shutdown()
{
    CefShutdown();
}

}
