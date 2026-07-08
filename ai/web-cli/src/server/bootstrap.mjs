// Bootstrap module for Socket.io server initialization.
//
// This file is imported at RUNTIME via raw Node.js dynamic import() from
// the Vite plugin's configureServer hook. It is NEVER processed by Vite's
// module bundler or SSR runner, which means `require('node-pty')` works
// correctly with native bindings.
//
// @ts-nocheck

// Load node-pty via createRequire (bypasses Vite module resolution)
import { createRequire } from "node:module";
import { Server as SocketServer } from "socket.io";

const _require = createRequire(import.meta.url);
let pty;
try {
	pty = _require("node-pty");
} catch (e) {
	console.error("[Bootstrap] Failed to load node-pty:", e.message);
	process.exit(1);
}

let io = null;
const sessions = new Map();

function getDefaultShell() {
	if (process.platform === "win32") return "powershell.exe";
	return process.env.SHELL || "/bin/bash";
}

function generateSessionId() {
	return `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Called by the Vite plugin to attach Socket.io to the existing HTTP server.
 */
export function attachToHttpServer(httpServer) {
	if (io) {
		console.log("[Bootstrap] Socket.io already initialized, skipping");
		return;
	}

	io = new SocketServer(httpServer, {
		cors: { origin: "*", methods: ["GET", "POST"] },
		path: "/socket.io",
		transports: ["websocket", "polling"],
		pingInterval: 25000,
		pingTimeout: 20000,
	});

	io.on("connection", (socket) => {
		const addr = socket.handshake.address;
		console.log(`[Bootstrap] Client connected: ${socket.id} from ${addr}`);
		console.log(`[Bootstrap] Active sessions: ${sessions.size}`);

		socket.on("terminal:connect", ({ cols, rows }) => {
			try {
				const shell = getDefaultShell();
				const sessionId = generateSessionId();
				const cwd = process.env.HOME || process.cwd();

				const ptyProcess = pty.spawn(shell, [], {
					name: "xterm-256color",
					cols: cols || 80,
					rows: rows || 24,
					cwd,
					env: { ...process.env, TERM: "xterm-256color" },
				});

				sessions.set(sessionId, {
					pty: ptyProcess,
					socketId: socket.id,
					sessionId,
				});

				// Pipe PTY output -> socket
				ptyProcess.onData((data) => {
					socket.emit("terminal:output", { sessionId, data });
				});

				// Handle PTY exit
				ptyProcess.onExit(({ exitCode }) => {
					socket.emit("terminal:exit", { sessionId, code: exitCode });
					sessions.delete(sessionId);
					console.log(
						`[Bootstrap] Session ${sessionId} exited with code ${exitCode}`,
					);
				});

				socket.emit("terminal:connected", { sessionId, pid: ptyProcess.pid });
				console.log(
					`[Bootstrap] PTY created: ${sessionId} (pid: ${ptyProcess.pid})`,
				);
			} catch (err) {
				console.error("[Bootstrap] Failed to create PTY:", err);
				socket.emit("terminal:error", {
					sessionId: "",
					message: `Failed to start terminal: ${err.message || String(err)}`,
				});
			}
		});

		socket.on("terminal:input", ({ sessionId, data }) => {
			const session = sessions.get(sessionId);
			if (session) {
				session.pty.write(data);
			}
		});

		socket.on("terminal:resize", ({ sessionId, cols, rows }) => {
			const session = sessions.get(sessionId);
			if (session) {
				session.pty.resize(cols, rows);
			}
		});

		socket.on("disconnect", (reason) => {
			console.log(
				`[Bootstrap] Client disconnected: ${socket.id}, reason: ${reason}`,
			);
			for (const [sid, session] of sessions.entries()) {
				if (session.socketId === socket.id) {
					try {
						session.pty.kill();
					} catch {}
					sessions.delete(sid);
					console.log(`[Bootstrap] Cleaned up session ${sid}`);
				}
			}
			console.log(`[Bootstrap] Active sessions remaining: ${sessions.size}`);
		});
	});

	console.log(
		"[Bootstrap] Socket.io server initialized on existing HTTP server",
	);
}

export function getSessionCount() {
	return sessions.size;
}
