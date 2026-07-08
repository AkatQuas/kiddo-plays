import type { Server as HttpServer } from "node:http";
import type { PluginOption } from "vite";

/**
 * TanStack Start Vite plugin that hooks Socket.io into the dev/preview server.
 *
 * Uses configureServer (dev) and configurePreviewServer (preview) to attach
 * Socket.io to the underlying Node HTTP server without adding new ports.
 *
 * CRITICAL: The server modules (pty-manager, socket-manager) use `require('node-pty')`
 * which has native bindings. Vite's module runner cannot resolve these.
 * Therefore this plugin NEEDS to use raw Node.js `import()` to load the bootstrap
 * file at runtime, bypassing Vite's resolution entirely.
 */
export function socketServerPlugin(): PluginOption {
	return {
		name: "tanstack-start:socket-server",
		enforce: "post",

		configureServer(server) {
			const httpServer = (server as unknown as { httpServer?: HttpServer })
				.httpServer;
			if (!httpServer) {
				console.warn("[SocketPlugin] No HTTP server found");
				return;
			}
			// Use raw import() on the bootstrap module — Vite.config.ts runs in native Node.js
			// so this import bypasses Vite's module runner entirely.
			const here = new URL(".", import.meta.url);
			import(new URL("bootstrap.mjs", here).href)
				.then((mod) => {
					mod.attachToHttpServer(httpServer);
				})
				.catch((err: Error) => {
					console.error("[SocketPlugin] Failed to initialize:", err);
				});
		},

		configurePreviewServer(server) {
			const httpServer = (server as unknown as { httpServer?: HttpServer })
				.httpServer;
			if (!httpServer) {
				console.warn("[SocketPlugin] No HTTP server found for preview");
				return;
			}
			const here = new URL(".", import.meta.url);
			import(new URL("bootstrap.mjs", here).href)
				.then((mod) => {
					mod.attachToHttpServer(httpServer);
				})
				.catch((err: Error) => {
					console.error("[SocketPlugin] Failed to initialize:", err);
				});
		},
	};
}
