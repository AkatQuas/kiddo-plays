import { homedir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const startWhistle = require("whistle");

const WHISTLE_PATH = startWhistle.getWhistlePath();
const BASE_DIR = WHISTLE_PATH;
const CLIENT_PLUGINS_PATH = path.join(WHISTLE_PATH, ".whistle_client_plugins");
const PROJECT_PLUGINS_PATH = path.join(__dirname, "../../node_modules");
const PROC_PATH = path.join(homedir(), ".whistle_client.pid");
const LOCALHOST = "127.0.0.1";
const SPECIAL_AUTH = `${Math.random()}`;

function sendMsg(data) {
	process.send?.(data);
}

function parseOptions() {
	try {
		return JSON.parse(decodeURIComponent(process.argv[2] ?? "{}"));
	} catch {
		return {};
	}
}

const newOptions = parseOptions();
const baseOptions = {
	baseDir: BASE_DIR,
	pluginsPath: [path.join(CLIENT_PLUGINS_PATH, "node_modules")],
	projectPluginsPath: PROJECT_PLUGINS_PATH,
	specialAuth: SPECIAL_AUTH,
	mode: "client|disableUpdateTips",
	...newOptions,
};

startWhistle(baseOptions, () => {
	sendMsg({
		type: "options",
		options: {
			...baseOptions,
			specialAuth: SPECIAL_AUTH,
		},
	});
	const host = baseOptions.host || LOCALHOST;
	const { port } = baseOptions;
	try {
		fs.outputFileSync(PROC_PATH, `${process.pid},${host},${port},${SPECIAL_AUTH}`);
	} catch {
		// ignore
	}
});

process.on("message", (data) => {
	if (data?.type === "exitWhistle") {
		process.exit();
	}
});

process.handleUncauthtWhistleErrorMessage = (stack, err) => {
	sendMsg({
		type: "error",
		message: err?.message || stack,
	});
};
