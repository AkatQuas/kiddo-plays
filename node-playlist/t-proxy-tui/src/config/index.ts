import { createRequire } from "node:module";
import path from "node:path";
import { config } from "./conf.js";

export * from "./constants.js";
export * from "./types.js";
export * from "./rules.js";
export { config } from "./conf.js";

const require = createRequire(import.meta.url);

export function getConfigDir(): string {
	return path.dirname(config.path);
}

export function getRulesFilePath(): string {
	return path.join(getConfigDir(), "whistle.rules");
}

export function getCertsDir(): string {
	return path.join(getConfigDir(), "certs");
}

export function getRootCertPath(): string {
	return path.join(getCertsDir(), "root.crt");
}

export function getRootKeyPath(): string {
	return path.join(getCertsDir(), "root.key");
}

export function getWhistleCertsDir(): string {
	const whistlePath = require("whistle").getWhistlePath() as string;
	return path.join(whistlePath, ".whistle", "certs");
}

export function getPort(): number {
	return config.get("port");
}

export function getHost(): string {
	return config.get("host");
}

export function getProxyWhitelist(): string {
	return config.get("proxyWhitelist");
}

export function setProxyWhitelist(value: string): void {
	config.set("proxyWhitelist", value);
}

export function markCertInstalled(): void {
	config.set("certInstalledAt", new Date().toISOString());
}

export function isCertMarkedInstalled(): boolean {
	return Boolean(config.get("certInstalledAt"));
}

export function getAppConfig() {
	return {
		proxyWhitelist: getProxyWhitelist(),
		port: getPort(),
		host: getHost(),
	};
}
