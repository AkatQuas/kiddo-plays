import { Store } from "@tanstack/store";

export type ConnectionStatus =
	| "disconnected"
	| "connecting"
	| "connected"
	| "error";

export interface TerminalSessionState {
	sessionId: string | null;
	pid: number | null;
	connected: boolean;
	connectionStatus: ConnectionStatus;
	cols: number;
	rows: number;
	error: string | null;
}

const defaultSessionState: TerminalSessionState = {
	sessionId: null,
	pid: null,
	connected: false,
	connectionStatus: "disconnected",
	cols: 80,
	rows: 24,
	error: null,
};

export const terminalSessionStore = new Store<TerminalSessionState>(
	defaultSessionState,
);

// Helper actions
export const terminalActions = {
	setConnecting: () => {
		terminalSessionStore.setState((prev) => ({
			...prev,
			connectionStatus: "connecting" as const,
			error: null,
		}));
	},

	setConnected: (sessionId: string, pid: number) => {
		terminalSessionStore.setState((prev) => ({
			...prev,
			sessionId,
			pid,
			connected: true,
			connectionStatus: "connected" as const,
			error: null,
		}));
	},

	setDisconnected: () => {
		terminalSessionStore.setState((prev) => ({
			...prev,
			...defaultSessionState,
		}));
	},

	setError: (message: string) => {
		terminalSessionStore.setState((prev) => ({
			...prev,
			connectionStatus: "error" as const,
			error: message,
		}));
	},

	setSize: (cols: number, rows: number) => {
		terminalSessionStore.setState((prev) => ({
			...prev,
			cols,
			rows,
		}));
	},
};
