#pragma once

class QApplication;

namespace CefBootstrap {

/** @return false when this invocation was a CEF subprocess that already exited. */
bool init(int argc, char **argv, QApplication &app);
void shutdown();

}
