#include "SidecarModule.h"

#include <QProcess>
#include <QTcpSocket>
#include <QJsonDocument>
#include <QJsonObject>
#include <QCoreApplication>
#include <QDir>
#include <stdexcept>

struct SidecarModule::State {
    QProcess *proc = nullptr;
    QTcpSocket *sock = nullptr;
    BridgeBus::EmitFn emit;
    QByteArray buf;
};

SidecarModule::SidecarModule(QObject *parent)
    : QObject(parent)
    , state_(new State)
{
}

void SidecarModule::registerInto(BridgeBus &bus)
{
    bus.registerHandler("sidecar", "start",
                        [this](const std::string &param, BridgeBus::EmitFn emit) {
                            state_->emit = emit;
                            if (state_->proc) {
                                return std::string("{\"alreadyRunning\":true}");
                            }

                            QJsonObject obj =
                                QJsonDocument::fromJson(QByteArray::fromStdString(param)).object();
                            const QString kind = obj.value(QStringLiteral("kind")).toString(QStringLiteral("node"));
                            const int port = obj.value(QStringLiteral("port")).toInt(58999);

                            const QString root = QDir(QCoreApplication::applicationDirPath())
                                                     .absoluteFilePath(QStringLiteral("../sidecar"));
                            // Also try source-tree relative when launched from build dir.
                            QString scriptDir = root;
                            if (!QDir(scriptDir).exists()) {
                                scriptDir = QDir(QCoreApplication::applicationDirPath())
                                                .absoluteFilePath(QStringLiteral("../../sidecar"));
                            }
                            if (!QDir(scriptDir).exists()) {
                                scriptDir = QStringLiteral("%1/sidecar")
                                                .arg(QCoreApplication::applicationDirPath());
                            }

                            state_->proc = new QProcess(this);
                            if (kind == QLatin1String("python")) {
                                state_->proc->setProgram(QStringLiteral("python3"));
                                state_->proc->setArguments(
                                    {scriptDir + QStringLiteral("/echo_server.py"),
                                     QString::number(port)});
                            } else {
                                state_->proc->setProgram(QStringLiteral("node"));
                                state_->proc->setArguments(
                                    {scriptDir + QStringLiteral("/echo-server.js"),
                                     QString::number(port)});
                            }
                            QObject::connect(state_->proc,
                                             QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
                                             this,
                                             [this](int code, QProcess::ExitStatus) {
                                                 if (state_->emit) {
                                                     state_->emit(
                                                         "sidecar.exited",
                                                         QStringLiteral("{\"code\":%1}")
                                                             .arg(code)
                                                             .toStdString());
                                                 }
                                                 state_->proc = nullptr;
                                                 if (state_->sock) {
                                                     state_->sock->deleteLater();
                                                     state_->sock = nullptr;
                                                 }
                                             });
                            state_->proc->start();
                            if (!state_->proc->waitForStarted(3000)) {
                                state_->proc->deleteLater();
                                state_->proc = nullptr;
                                throw std::runtime_error("sidecar failed to start");
                            }

                            state_->sock = new QTcpSocket(this);
                            state_->buf.clear();
                            QObject::connect(state_->sock, &QTcpSocket::readyRead, this, [this]() {
                                state_->buf += state_->sock->readAll();
                                int idx;
                                while ((idx = state_->buf.indexOf('\n')) >= 0) {
                                    const QByteArray line = state_->buf.left(idx);
                                    state_->buf.remove(0, idx + 1);
                                    if (line.trimmed().isEmpty())
                                        continue;
                                    if (state_->emit) {
                                        state_->emit("sidecar.received.message", line.toStdString());
                                    }
                                }
                            });

                            // Concept: brief spin wait — not production quality.
                            for (int i = 0; i < 40; ++i) {
                                state_->sock->connectToHost(QStringLiteral("127.0.0.1"),
                                                            static_cast<quint16>(port));
                                if (state_->sock->waitForConnected(50))
                                    break;
                                state_->sock->abort();
                            }
                            if (state_->sock->state() != QAbstractSocket::ConnectedState) {
                                throw std::runtime_error("sidecar tcp connect failed");
                            }

                            QJsonObject out;
                            out.insert(QStringLiteral("started"), true);
                            out.insert(QStringLiteral("kind"), kind);
                            out.insert(QStringLiteral("port"), port);
                            return QString::fromUtf8(QJsonDocument(out).toJson(QJsonDocument::Compact))
                                .toStdString();
                        });

    bus.registerHandler("sidecar", "stop",
                        [this](const std::string &, BridgeBus::EmitFn) {
                            if (state_->sock) {
                                state_->sock->disconnectFromHost();
                                state_->sock->deleteLater();
                                state_->sock = nullptr;
                            }
                            if (state_->proc) {
                                state_->proc->kill();
                                state_->proc->waitForFinished(1000);
                                state_->proc->deleteLater();
                                state_->proc = nullptr;
                            }
                            return std::string("{\"stopped\":true}");
                        });

    bus.registerHandler("sidecar", "send",
                        [this](const std::string &param, BridgeBus::EmitFn) {
                            if (!state_->sock ||
                                state_->sock->state() != QAbstractSocket::ConnectedState) {
                                throw std::runtime_error("sidecar not connected");
                            }
                            QByteArray line = QByteArray::fromStdString(param);
                            if (!line.endsWith('\n'))
                                line.append('\n');
                            state_->sock->write(line);
                            return std::string("{\"sent\":true}");
                        });
}
