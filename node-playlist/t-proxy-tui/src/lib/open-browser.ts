import { exec } from "node:child_process";

export function openInBrowser(url: string): void {
	const cmd =
		process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
	exec(`${cmd} ${JSON.stringify(url)}`);
}
