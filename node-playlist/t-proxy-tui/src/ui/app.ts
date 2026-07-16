import chalk from "chalk";
import {
	Box,
	CancellableLoader,
	Key,
	matchesKey,
	ProcessTerminal,
	Spacer,
	Text,
	TUI,
} from "@earendil-works/pi-tui";
import {
	BRAND_NAME,
	getAppConfig,
	getPort,
	getRules,
} from "../config/index.js";
import { ensureRootCA } from "../cert/manager.js";
import { formatError } from "../lib/errors.js";
import { checkSystemProxyWork, getIp } from "../proxy/system-check.js";
import {
	applyRules,
	buildRulesContent,
	startWhistle,
} from "../proxy/whistle-manager.js";
import type { AppContext, AppState } from "./context.js";
import { renderHome } from "./screens/home.js";
import { renderRules } from "./screens/rules.js";
import { renderSettings } from "./screens/settings.js";
import { createShutdown, registerShutdownSignals, requestShutdown } from "./shutdown.js";

export async function runApp(): Promise<void> {
	const terminal = new ProcessTerminal();
	const tui = new TUI(terminal);

	const state: AppState = {
		screen: "home",
		status: { running: false, ip: getIp(), port: getPort() },
		rules: [],
		whitelist: "",
	};

	let overlayHandle: ReturnType<TUI["showOverlay"]> | null = null;
	let shuttingDown = false;
	let loader: CancellableLoader | null = null;

	const statusLine = new Text("", 0, 0);
	const messageLine = new Text("", 0, 0);
	const mainBox = new Box(1, 0);
	const contentBox = new Box(1, 0);

	async function refreshStatus(): Promise<void> {
		state.status = {
			running: await checkSystemProxyWork(),
			ip: getIp(),
			port: getPort(),
		};
		const proxyState = state.status.running
			? chalk.green("● 系统代理已开启")
			: chalk.red("○ 系统代理未开启");
		statusLine.setText(`${proxyState}  ${state.status.ip}:${state.status.port}  Whistle :${getPort()}`);
	}

	function refreshRules(): void {
		state.rules = getRules();
	}

	async function syncRulesToWhistle(): Promise<void> {
		await applyRules(buildRulesContent(state.rules));
	}

	function setMessage(msg: string): void {
		messageLine.setText(msg ? chalk.yellow(msg) : "");
		tui.requestRender();
	}

	function hideOverlay(): void {
		overlayHandle?.hide();
		overlayHandle = null;
	}

	const shutdown = createShutdown({
		tui,
		terminal,
		getLoader: () => loader,
		setShuttingDown: (value) => {
			if (shuttingDown) return true;
			shuttingDown = value;
			return false;
		},
	});

	const ctx: AppContext = {
		tui,
		terminal,
		contentBox,
		state,
		setMessage,
		requestRender: () => tui.requestRender(),
		hideOverlay,
		setOverlay: (handle) => {
			overlayHandle = handle;
		},
		refreshStatus,
		refreshRules,
		syncRulesToWhistle,
		shutdown,
		navigate: {
			home: () => {
				state.screen = "home";
				renderHome(ctx);
				tui.requestRender();
			},
			rules: () => {
				state.screen = "rules";
				renderRules(ctx);
				tui.requestRender();
			},
			settings: () => {
				state.screen = "settings";
				renderSettings(ctx);
				tui.requestRender();
			},
		},
	};

	mainBox.addChild(statusLine);
	mainBox.addChild(messageLine);
	mainBox.addChild(new Spacer(1));
	mainBox.addChild(contentBox);
	tui.addChild(mainBox);

	tui.addInputListener((data) => {
		if (matchesKey(data, Key.ctrl("c"))) {
			requestShutdown(shutdown, 0);
			return { consume: true };
		}
	});

	loader = new CancellableLoader(
		tui,
		(s) => chalk.cyan(s),
		(s) => chalk.dim(s),
		`正在启动 ${BRAND_NAME}...`,
	);
	tui.addChild(loader);
	tui.start();
	loader.start();

	try {
		await startWhistle();
		await ensureRootCA();
		const appConfig = getAppConfig();
		state.whitelist = appConfig.proxyWhitelist;
		refreshRules();
		await refreshStatus();
	} catch (err) {
		loader.stop();
		tui.removeChild(loader);
		tui.addChild(new Text(chalk.red(`启动失败: ${formatError(err)}`)));
		tui.requestRender();
		registerShutdownSignals(shutdown);
		return;
	}

	loader.stop();
	tui.removeChild(loader);
	loader = null;
	renderHome(ctx);
	tui.requestRender();

	registerShutdownSignals(shutdown);
}
