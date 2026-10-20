# edgehop domain

## Glossary

**Focus** — Which device currently receives injected mouse/keyboard input. Exactly one device in the layout group has focus at a time.

**FocusSession** — Deep module that owns focus arbitration (`seq` + `origin`), the local **pinning** flag, and emits focus changes. Callers request a switch or apply a remote focus message; they do not mutate pinning themselves.

**Pinning** — Local mode while focus is on another device: cursor is parked and input deltas are forwarded to the focused peer.

**Layout** — Ordered left→right list of devices (`DEVICES`). Edge crossings hand focus to the neighbor in this list.

**OsInput** — Adapter seam for raw OS input observation (move / button / wheel / key). Production adapter: uiohook. Tests: in-memory fake.

**InputPolicy** — Deep module for edge switching, reclaim hotkey, pinning forward path, and outbound input messages. Depends on FocusSession, network, pointer sink, and an OsInput adapter.

**Pointer sink** — Local injection of cursor position / buttons / keys (Injector via robotjs).
