import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sudoPrompt = require("@vscode/sudo-prompt") as {
	exec: (
		cmd: string,
		options: { name: string },
		cb: (err: Error | null, stdout: string, stderr: string) => void,
	) => void;
};

const requireW2 = require("whistle/require") as (id: string) => {
	enableProxy: (options: {
		host: string;
		port: number;
		bypass?: string[];
		sudo?: boolean;
	}) => boolean;
	disableProxy: (sudo?: boolean) => boolean;
	sudoMacProxyHelper: (
		sudoPrompt: (cmd: string, cb: (err: Error | null, stdout?: string) => void) => void,
	) => Promise<void>;
	getBypass: (bypass: string) => string[] | undefined;
};

const { enableProxy, disableProxy, sudoMacProxyHelper, getBypass } = requireW2("set-global-proxy");

// sudo-prompt: alphanumeric + spaces only, no hyphens
const SUDO_OPTIONS = { name: "TProxy" };
const SUDO_PROMPT = (cmd: string, cb: (err: Error | null, stdout?: string) => void) => {
	sudoPrompt.exec(cmd, SUDO_OPTIONS, (err, stdout, stderr) => {
		cb(err ?? (stderr ? new Error(stderr) : null), stdout);
	});
};

let isEnabled = false;
let helperInstalled = false;

export interface DisableSystemProxyOptions {
	/** When false, never prompt for sudo (used during app exit). */
	interactive?: boolean;
}

async function ensureProxyHelper(): Promise<void> {
	if (helperInstalled) return;
	await sudoMacProxyHelper(SUDO_PROMPT);
	helperInstalled = true;
}

export async function enableSystemProxy(options: {
	port: number;
	host: string;
	bypass?: string;
}): Promise<void> {
	await ensureProxyHelper();
	const bypass = options.bypass ? getBypass(options.bypass.trim().toLowerCase()) : undefined;
	const ok = enableProxy({
		port: options.port,
		host: options.host,
		bypass,
		sudo: true,
	});
	if (!ok) {
		isEnabled = false;
		throw new Error("系统代理设置失败，请确认已授权管理员权限");
	}
	isEnabled = true;
}

export async function disableSystemProxy(options: DisableSystemProxyOptions = {}): Promise<void> {
	if (!isEnabled) return;

	const interactive = options.interactive ?? true;

	try {
		if (interactive && !helperInstalled) {
			await ensureProxyHelper();
		}
		if (helperInstalled || !interactive) {
			const ok = disableProxy(interactive);
			if (!ok && interactive) {
				throw new Error("系统代理关闭失败");
			}
		}
	} catch {
		// best-effort on shutdown; avoid crashing the process
	} finally {
		isEnabled = false;
	}
}
