import fs from "fs-extra";
import { LOCALHOST, getPort, getProxyWhitelist, getRulesFilePath } from "../config/index.js";
import { disableSystemProxy, enableSystemProxy } from "./system-proxy.js";
import type { DisableSystemProxyOptions } from "./system-proxy.js";
import { buildRulesContent } from "./rules-builder.js";
import { pushRulesToWhistle, startWhistle as startWhistleChild, stopWhistleChild } from "./whistle-client.js";

export { buildRulesContent } from "./rules-builder.js";
export { getWhistleOptions } from "./whistle-client.js";

export interface StopWhistleOptions extends DisableSystemProxyOptions {}

export async function startWhistle(): Promise<void> {
	return startWhistleChild();
}

export async function stopWhistle(options: StopWhistleOptions = {}): Promise<void> {
	await disableSystemProxy(options);
	await stopWhistleChild();
}

export async function startProxy(): Promise<void> {
	await enableSystemProxy({
		port: getPort(),
		host: LOCALHOST,
		bypass: getProxyWhitelist(),
	});
}

export async function stopProxy(): Promise<void> {
	await disableSystemProxy();
}

export async function restartProxy(): Promise<void> {
	await stopProxy();
	await startProxy();
}

export async function applyRules(rulesText: string): Promise<void> {
	const rulesFile = getRulesFilePath();
	await fs.outputFile(rulesFile, rulesText);
	return pushRulesToWhistle(rulesText);
}

export { getPort, LOCALHOST };
