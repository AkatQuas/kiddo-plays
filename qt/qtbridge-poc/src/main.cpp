#include "host/CefBootstrap.h"
#include "host/BridgeBus.h"
#include "host/modules/SystemModule.h"
#include "host/modules/SidecarModule.h"
#include "cef/QtBridgeView.h"

#include <QApplication>
#include <QCoreApplication>
#include <QMainWindow>
#include <QUrl>
#include <QDir>
#include <QFileInfo>

static QString demoPageUrl()
{
    // CEF does not speak Qt qrc:// — load a real file path (concept page).
    const QStringList candidates = {
        QDir(QCoreApplication::applicationDirPath()).absoluteFilePath(QStringLiteral("web/index.html")),
        QDir(QCoreApplication::applicationDirPath()).absoluteFilePath(QStringLiteral("../web/index.html")),
        QDir(QCoreApplication::applicationDirPath()).absoluteFilePath(QStringLiteral("../../web/index.html")),
        QStringLiteral("%1/web/index.html").arg(QStringLiteral(QTBRIDGE_POC_SOURCE_DIR)),
    };
    for (const QString &path : candidates) {
        if (QFileInfo::exists(path)) {
            return QUrl::fromLocalFile(path).toString();
        }
    }
    return QStringLiteral("data:text/html,<h1>qtbridge-poc</h1><p>demo page missing</p>");
}

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);
    app.setApplicationName(QStringLiteral("qtbridge-poc"));

    if (!CefBootstrap::init(argc, argv, app)) {
        // CEF sub-process finished, or init failed.
        return 0;
    }

    BridgeBus bus;
    registerSystemModule(bus);
    SidecarModule sidecar;
    sidecar.registerInto(bus);

    QMainWindow window;
    window.setWindowTitle(QStringLiteral("QtBridge PoC"));
    window.resize(900, 640);

    auto *view = new QtBridgeView(&bus, &window);
    window.setCentralWidget(view);
    window.show();

    view->loadUrl(demoPageUrl());

    const int rc = app.exec();
    CefBootstrap::shutdown();
    return rc;
}
