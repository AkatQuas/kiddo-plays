# VNC：Play with OpenClaw in E2B Sandbox through VNC

VNC lets you watch and play OpenClaw inside an E2B sandbox by streaming the game’s virtual screen to your computer over a secure tunnel.

**VNC = Virtual Network Computing**

It’s a system that lets you:

- **See the screen** of a remote computer (or sandbox)

- **Control it with your mouse &amp; keyboard**

- As if you were sitting in front of it

It works like this:

1. A **VNC Server** runs on the remote machine (your E2B sandbox)

2. A **VNC Viewer** runs on your laptop/PC

3. They connect over the network

4. You see the desktop and control apps

VNC is **platform-independent**:
Windows ↔ Linux ↔ macOS ↔ E2B sandbox — all work.

---

# Why you need VNC for E2B + OpenClaw

E2B sandboxes are **headless** — they have no physical screen, no monitor, no GUI.

But OpenClaw is a **graphical game** that needs:

- A display (X11)

- A way to _see_ what’s happening

So we need two things:

1. **Xvfb** = virtual fake screen (so the game thinks there’s a monitor)

2. **x11vnc** = VNC server that streams that virtual screen to you

---

# How VNC works step-by-step in E2B

## 1. Inside the sandbox: Create a virtual screen

We run **Xvfb** (X Virtual Framebuffer):

```bash
Xvfb :1 -screen 0 1280x720x16
```

This creates:

- Display `:1`

- Resolution 1280x720

- 16-bit color

No actual monitor — just memory.

## 2. Tell OpenClaw to use this display

```bash
export DISPLAY=:1
./OpenClaw
```

Now the game draws to the virtual screen.

## 3. Start VNC server to stream that screen

```bash
x11vnc -display :1 -forever -shared
```

This:

- Streams display `:1` over the network

- Lets multiple viewers connect (`-shared`)

- Runs forever until stopped

## 4. Forward the VNC port from E2B to your computer

E2B sandboxes are secure and isolated — you can’t connect directly.
So you **port forward** VNC’s default port `5900`:

In Python SDK:

```python
sbx.forward_port(5900)
```

Now:

- Your local `localhost:5900`

- → tunnels to E2B sandbox’s `5900`

- → connects to x11vnc

## 5. Open a VNC Viewer on your PC

You need one of these VNC Viewers (free, easy) on your computer, :

- **TightVNC** (Windows/Linux)

- **RealVNC Viewer** (all platforms)

- **UltraVNC**

- **Remmina** (Linux)

- **Screen Sharing** (macOS built-in, supports VNC)

All work the same way:

1. Open viewer

2. Enter `localhost:5900`

3. Connect

4. You see the sandbox GUI, you can click, you can press keys

---

# Security note for E2B

- E2B sandboxes are short-lived and isolated

- Port forward only exists while your sandbox runs

- When sandbox dies → VNC connection dies

- No risk of external access
