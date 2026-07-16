import { exec } from "node:child_process";
import { promisify } from "node:util";
import ip from "ip";
import os from "os";
import { LOCALHOST, getPort } from "../config/index.js";

const execAsync = promisify(exec);

export const SYSTEM_IS_MACOS = os.type() === "Darwin";

export function getIp(): string {
	return ip.address();
}

export async function checkSystemProxyWork(
	address = LOCALHOST,
	port = getPort(),
): Promise<boolean> {
	if (!SYSTEM_IS_MACOS) {
		const WINDOWS_QUERY_PROXY =
			'reg query "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"';
		const WINDOWS_PROXY_ENABLE_REGEX = /ProxyEnable\s+REG_DWORD\s+0x1/;
		const currentProxyRegex = new RegExp(`ProxyServer\\s+REG_SZ\\s+${address}:${port}`);

		try {
			const { stdout } = await execAsync(WINDOWS_QUERY_PROXY);
			return WINDOWS_PROXY_ENABLE_REGEX.test(stdout) && currentProxyRegex.test(stdout);
		} catch {
			return false;
		}
	}

	try {
		const { stdout } = await execAsync("scutil --proxy");
		const output = stdout.toString();
		if (output === '<dictionary> {\n}\n') {
			return false;
		}
		const jsonContent = convertOutputToJSON(output);
		const info = JSON.parse(jsonContent) as Record<string, string>;
		const portStr = String(port);
		return (
			info.HTTPEnable === "1" &&
			info.HTTPPort === portStr &&
			info.HTTPProxy === address &&
			info.HTTPSEnable === "1" &&
			info.HTTPSPort === portStr &&
			info.HTTPSProxy === address &&
			info.ProxyAutoConfigEnable === "0" &&
			info.SOCKSEnable === "0"
		);
	} catch {
		return false;
	}
}

function convertOutputToJSON(output: string): string {
	const content = /{[^]*?}/.exec(output.replace(/ExceptionsList.*\n.*\n.*\n/, ""))?.[0] ?? "{}";
	return content
		.replace(/([a-zA-Z0-9.]+)/g, '"$1"')
		.replace(/"\n/g, '",\n')
		.replace(/,.*\n?}/, "}");
}
