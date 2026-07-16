import type { Box, ProcessTerminal, TUI } from "@earendil-works/pi-tui";
import type { ProxyRule } from "../config/types.js";

export type Screen = "home" | "rules" | "settings";

export interface ProxyStatus {
	running: boolean;
	ip: string;
	port: number;
}

export interface AppState {
	screen: Screen;
	status: ProxyStatus;
	rules: ProxyRule[];
	whitelist: string;
}

export interface AppContext {
	tui: TUI;
	terminal: ProcessTerminal;
	contentBox: Box;
	state: AppState;
	setMessage(msg: string): void;
	requestRender(): void;
	hideOverlay(): void;
	setOverlay(handle: ReturnType<TUI["showOverlay"]> | null): void;
	refreshStatus(): Promise<void>;
	refreshRules(): void;
	syncRulesToWhistle(): Promise<void>;
	shutdown(exitCode?: number): Promise<void>;
	navigate: {
		home(): void;
		rules(): void;
		settings(): void;
	};
}
