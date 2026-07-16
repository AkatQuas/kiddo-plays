import type { CancellableLoader, ProcessTerminal, TUI } from "@earendil-works/pi-tui";
import { stopWhistle } from "../proxy/whistle-manager.js";

export interface ShutdownDeps {
	tui: TUI;
	terminal: ProcessTerminal;
	getLoader(): CancellableLoader | null;
	setShuttingDown(value: boolean): boolean;
}

export function createShutdown(deps: ShutdownDeps) {
	return async function shutdown(exitCode = 0): Promise<void> {
		if (deps.setShuttingDown(true)) return;

		deps.getLoader()?.stop();

		try {
			await stopWhistle({ interactive: false });
		} catch {
			// ignore cleanup errors
		}

		try {
			deps.tui.stop();
			await deps.terminal.drainInput(500, 50);
		} catch {
			// ignore terminal restore errors
		}

		process.exit(exitCode);
	};
}

/** Run shutdown outside the current input/onChange stack (avoids TUI deadlock). */
export function requestShutdown(shutdown: (code?: number) => Promise<void>, exitCode = 0): void {
	setImmediate(() => {
		void shutdown(exitCode);
	});
}

export function registerShutdownSignals(shutdown: (code?: number) => Promise<void>): void {
	process.on("SIGINT", () => void shutdown(0));
	process.on("SIGTERM", () => void shutdown(0));
}
