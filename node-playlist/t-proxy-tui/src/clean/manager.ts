import { createRequire } from "node:module";
import path from "node:path";
import fs from "fs-extra";
import { getConfigDir } from "../config/index.js";
import { WHISTLE_PROC_PATH } from "../lib/whistle-paths.js";

const require = createRequire(import.meta.url);

export interface CleanTarget {
	label: string;
	path: string;
}

export function getWhistleDataDir(): string {
	return require("whistle").getWhistlePath() as string;
}

export function getCleanTargets(): CleanTarget[] {
	const whistleDataDir = getWhistleDataDir();

	return [
		{ label: "T-Proxy 配置与规则", path: getConfigDir() },
		{ label: "Whistle 运行时数据", path: path.join(whistleDataDir, ".whistle") },
		{ label: "Whistle 日志", path: path.join(whistleDataDir, "whistle.log") },
		{ label: "Whistle 错误日志", path: path.join(whistleDataDir, "whistle-error.log") },
		{ label: "Whistle 客户端 PID", path: WHISTLE_PROC_PATH },
	];
}

export async function listExistingCleanTargets(): Promise<CleanTarget[]> {
	const existing: CleanTarget[] = [];

	for (const target of getCleanTargets()) {
		if (await fs.pathExists(target.path)) {
			existing.push(target);
		}
	}

	return existing;
}

export async function runClean(options: { yes?: boolean; dryRun?: boolean } = {}): Promise<void> {
	const targets = await listExistingCleanTargets();

	if (targets.length === 0) {
		return;
	}

	if (!options.yes && !options.dryRun) {
		const { confirm } = await import("./prompt.js");
		const ok = await confirm("确认删除以上所有 T-Proxy / Whistle 本地数据？");
		if (!ok) {
			throw new Error("已取消清理");
		}
	}

	for (const target of targets) {
		if (options.dryRun) {
			continue;
		}
		await fs.remove(target.path);
	}
}
