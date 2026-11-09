#pragma once

#include "../BridgeBus.h"

#include <QObject>

/** Optional replaceable local process. */
class SidecarModule : public QObject {
    Q_OBJECT
public:
    explicit SidecarModule(QObject *parent = nullptr);
    void registerInto(BridgeBus &bus);

private:
    struct State;
    State *state_;
};
