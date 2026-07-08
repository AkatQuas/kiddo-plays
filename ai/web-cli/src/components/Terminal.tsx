import { useSelector } from "@tanstack/react-store";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { terminalActions, terminalSessionStore } from "../lib/terminal-store";

let socket: Socket | null = null;
let TerminalClass: any = null;
let FitAddonClass: any = null;
let WebLinksAddonClass: any = null;

// Dynamically import xterm only in browser environment
async function ensureXtermLoaded() {
	if (typeof window === "undefined") return false;
	if (TerminalClass) return true;

	try {
		const XTermModule = await import("@xterm/xterm");
		TerminalClass = XTermModule.Terminal;
		const FitModule = await import("@xterm/addon-fit");
		FitAddonClass = FitModule.FitAddon;
		const LinksModule = await import("@xterm/addon-web-links");
		WebLinksAddonClass = LinksModule.WebLinksAddon;
		return true;
	} catch (err) {
		console.error("[Terminal] Failed to load xterm:", err);
		return false;
	}
}

export default function TerminalApp() {
	const terminalRef = useRef<HTMLDivElement>(null);
	const xtermRef = useRef<any>(null);
	const fitAddonRef = useRef<any>(null);
	const sessionIdRef = useRef<string | null>(null);
	const loadedRef = useRef(false);
	const state = useSelector(terminalSessionStore, (state) => state);

	// Initialize xterm.js (browser only, after mount)
	useEffect(() => {
		if (!terminalRef.current || loadedRef.current) return;

		loadedRef.current = true;

		ensureXtermLoaded()
			.then((loaded) => {
				if (!loaded || !terminalRef.current) return;

				const Terminal = TerminalClass;
				const FitAddon = FitAddonClass;
				const WebLinksAddon = WebLinksAddonClass;

				const term = new Terminal({
					cursorBlink: true,
					cursorStyle: "block",
					fontSize: 14,
					fontFamily: 'Menlo, Monaco, "Courier New", monospace',
					lineHeight: 1.2,
					letterSpacing: 0,
					theme: {
						background: "#0d1117",
						foreground: "#e6edf3",
						cursor: "#e6edf3",
						selectionBackground: "#264f78",
						black: "#484f58",
						red: "#ff7b72",
						green: "#3fb950",
						yellow: "#d29922",
						blue: "#58a6ff",
						magenta: "#bc8cff",
						cyan: "#39c5cf",
						white: "#b1bac4",
						brightBlack: "#6e7681",
						brightRed: "#ffa198",
						brightGreen: "#56d364",
						brightYellow: "#e3b341",
						brightBlue: "#79c0ff",
						brightMagenta: "#d2a8ff",
						brightCyan: "#56d4dd",
						brightWhite: "#f0f6fc",
					},
					allowTransparency: true,
					cols: 80,
					rows: 24,
				});

				const fitAddon = new FitAddon();
				term.loadAddon(fitAddon);
				term.loadAddon(new WebLinksAddon());
				fitAddonRef.current = fitAddon;

				term.open(terminalRef.current!);
				xtermRef.current = term;

				// Fit terminal to container
				const fitTerminal = () => {
					try {
						fitAddon.fit();
						const { cols, rows } = term;
						terminalActions.setSize(cols, rows);

						// Notify server of resize
						if (sessionIdRef.current && socket?.connected) {
							socket.emit("terminal:resize", {
								sessionId: sessionIdRef.current,
								cols,
								rows,
							});
						}
					} catch {
						// Ignore fit errors during initialization
					}
				};

				// Debounced resize handler
				let resizeTimer: ReturnType<typeof setTimeout> | null = null;
				const handleResize = () => {
					if (resizeTimer) clearTimeout(resizeTimer);
					resizeTimer = setTimeout(fitTerminal, 100);
				};

				window.addEventListener("resize", handleResize);
				// Initial fit after mount
				setTimeout(fitTerminal, 50);

				// Line buffer tracks multi-line input content.
				// Normal keystrokes pass through to PTY for proper echo.
				// Shift+Enter / Ctrl+J insert \n into buffer WITHOUT sending.
				// Bare Enter flushes accumulated newlines + final \r.
				let lineBuffer = "";
				let isInMultiLine = false;

				// Intercept modifier+Enter before xterm converts it to \r
				term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
					if (e.type !== "keydown") return true;

					// Ctrl+J — insert newline in buffer, don't send to PTY
					if (e.ctrlKey && e.key === "j") {
						lineBuffer += "\n";
						isInMultiLine = true;
						term.write("\r\n");
						return false;
					}

					// Shift+Enter — insert newline in buffer, don't send to PTY
					if (e.shiftKey && e.key === "Enter") {
						lineBuffer += "\n";
						isInMultiLine = true;
						term.write("\r\n");
						return false;
					}

					return true;
				});

				// onData fires for each keystroke after xterm processes it.
				// Normal chars: forward to PTY (it handles echo).
				// \r (Enter): if multi-line, flush buffer + \r; else just send \r.
				term.onData((data: string) => {
					if (!sessionIdRef.current || !socket?.connected) return;

					// \r (bare Enter)
					if (data === "\r") {
						if (isInMultiLine) {
							// Flush buffered newlines + final Enter
							isInMultiLine = false;
							const fullInput = lineBuffer + "\r";
							lineBuffer = "";
							socket.emit("terminal:input", {
								sessionId: sessionIdRef.current,
								data: fullInput,
							});
						} else {
							// Normal: send \r to execute command
							socket.emit("terminal:input", {
								sessionId: sessionIdRef.current,
								data: "\r",
							});
						}
						return;
					}

					// Everything else (printable, backspace, ctrl, arrows, paste):
					// forward to PTY. It echoes and renders correctly.
					socket.emit("terminal:input", {
						sessionId: sessionIdRef.current,
						data,
					});
				});

				// If socket already connected, request terminal session
				if (socket?.connected) {
					socket.emit("terminal:connect", {
						cols: term.cols,
						rows: term.rows,
					});
				}

				// Store cleanup
				const currentTerm = term;
				return () => {
					window.removeEventListener("resize", handleResize);
					if (resizeTimer) clearTimeout(resizeTimer);
					currentTerm.dispose();
					xtermRef.current = null;
				};
			})
			.catch((err) => {
				console.error("[Terminal] Error initializing xterm:", err);
			});
	}, []);

	// Initialize Socket.io connection
	useEffect(() => {
		if (socket) return;

		terminalActions.setConnecting();
		console.log("[Terminal] Connecting to Socket.io...");

		const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
		const wsUrl = `${protocol}//${window.location.host}`;

		socket = io(wsUrl, {
			path: "/socket.io",
			transports: ["websocket", "polling"],
			reconnection: true,
			reconnectionAttempts: Infinity,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
		});

		socket.on("connect", () => {
			console.log("[Terminal] Socket connected:", socket?.id);
			terminalActions.setConnecting();

			// If xterm already loaded, request terminal session
			const term = xtermRef.current;
			if (socket && term) {
				socket.emit("terminal:connect", {
					cols: term.cols,
					rows: term.rows,
				});
			}
		});

		socket.on("terminal:connected", ({ sessionId, pid }) => {
			console.log(`[Terminal] Session created: ${sessionId} (pid: ${pid})`);
			sessionIdRef.current = sessionId;
			terminalActions.setConnected(sessionId, pid);
		});

		socket.on("terminal:output", ({ data }) => {
			const term = xtermRef.current;
			if (term) {
				term.write(data);
			}
		});

		socket.on("terminal:error", ({ message }) => {
			console.error("[Terminal] Server error:", message);
			terminalActions.setError(message);
			const term = xtermRef.current;
			if (term) {
				term.writeln(`\r\n\x1b[31m[Error]\x1b[0m ${message}`);
			}
		});

		socket.on("terminal:exit", ({ sessionId, code }) => {
			console.log(`[Terminal] Session ${sessionId} exited with code ${code}`);
			const term = xtermRef.current;
			if (term) {
				term.writeln(`\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m`);
				term.writeln(
					"\r\n\x1b[32m[Close this tab and reopen to start a new session]\x1b[0m",
				);
			}
		});

		socket.on("disconnect", (reason) => {
			console.log("[Terminal] Socket disconnected:", reason);
			terminalActions.setDisconnected();
			sessionIdRef.current = null;
		});

		socket.on("connect_error", (err) => {
			console.error("[Terminal] Connection error:", err.message);
			terminalActions.setError(err.message);
		});

		return () => {
			if (socket) {
				socket.disconnect();
				socket = null;
			}
		};
	}, []);

	// Status indicator color
	const statusColor =
		state.connectionStatus === "connected"
			? "bg-[#3fb950]"
			: state.connectionStatus === "connecting"
				? "bg-[#d29922] animate-pulse"
				: state.connectionStatus === "error"
					? "bg-[#ff7b72]"
					: "bg-[#484f58]";

	const statusText =
		state.connectionStatus === "connected"
			? "Connected"
			: state.connectionStatus === "connecting"
				? "Connecting..."
				: state.connectionStatus === "error"
					? `Error: ${state.error || "Unknown"}`
					: "Disconnected";

	return (
		<div className="flex flex-col h-full">
			{/* Status bar */}
			<div className="flex items-center justify-between px-4 py-1.5 text-xs font-mono bg-[#161b22] border-b border-[#30363d] text-[#8b949e] shrink-0">
				<div className="flex items-center gap-2">
					<span
						className={`inline-block w-2 h-2 rounded-full ${statusColor}`}
					/>
					<span>{statusText}</span>
				</div>
				<div className="flex items-center gap-3">
					{state.sessionId && (
						<span title="Session ID">Session: {state.sessionId.slice(-8)}</span>
					)}
					{state.pid && <span title="Process ID">PID: {state.pid}</span>}
					<span title="Terminal size">
						{state.cols}x{state.rows}
					</span>
				</div>
			</div>

			{/* Terminal container */}
			<div className="flex-1 min-h-0 bg-[#0d1117]">
				<div ref={terminalRef} className="h-full w-full" />
			</div>
		</div>
	);
}
