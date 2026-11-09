# qtbridge-poc

Concept proof for a technical blog: embed open-source CEF in a Qt host, inject `QtBridge` into the page, and treat local capability processes as a replaceable sidecar.

⚠️ Not a product shell and not meant to be production-ready.

## Concept

```text
Qt Host
  ├─ CEF (browser + render helpers)
  │    └─ window.QtBridge(module, method, callbackId, param)
  ├─ BridgeBus (dispatch by module/method)
  │    └─ onCallback / onEvent back into the page
  └─ Sidecar (optional: Node / Python / …, TCP JSON lines)
```

The host owns the window and the native bridge. Language runtimes for business logic are not part of the host.

## Page protocol

```js
QtBridge(module, method, callbackId, param)  // four strings; param is usually JSON text

onCallback(callbackId, errorInfo, data)
onEvent(eventId, data)
```

Render → browser process message name: `QtBridge.Native.Call` (same four-argument payload).

## Pinned CEF (macOS arm64)

This repo pins one Spotify public build (Chromium 156 line):

```text
https://cef-builds.spotifycdn.com/cef_binary_156.0.26%2Bg8ea0c73%2Bchromium-156.0.8078.88_macosarm64.tar.bz2
```

Index: <https://cef-builds.spotifycdn.com/index.html#macosarm64>

```bash
./scripts/fetch-cef.sh
./scripts/build-cef-wrapper.sh
```

Output directory: `third_party/cef/` (gitignored). `CEF_ROOT` defaults there; you may export another path to override.

## Build and bundle (concept)

Requires local **Qt 5**, CMake, and Xcode CLT. Uses multi-process CEF with the usual macOS Helper layout:

```bash
qmake qtbridge.pro
make -j
./scripts/bundle-mac.sh
open dist/qtbridge-poc.app
```

`bundle-mac.sh` places the main binary, Helpers, and CEF’s `Chromium Embedded Framework.framework` into a standard `.app` bundle.

## Layout

| Path | Role |
|------|------|
| `src/host/` | CEF bootstrap, BridgeBus, sample modules |
| `src/cef/` | CefApp / V8 inject / Client / QWidget host |
| `helper/` | CEF subprocess entry (Renderer, etc.) |
| `web/` | Demo page |
| `sidecar/` | Replaceable echo services (Node / Python) |
| `scripts/` | Fetch CEF, build wrapper, macOS bundle |

## Intentionally out of scope

- Product hot-update / multi-arch release matrix
- Production stability claims
