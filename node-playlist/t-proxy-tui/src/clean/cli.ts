#!/usr/bin/env node
import chalk from "chalk";
import { BRAND_NAME } from "../config/constants.js";
import { formatError } from "../lib/errors.js";
import { listExistingCleanTargets, runClean } from "./manager.js";

const USAGE = `
${chalk.bold(BRAND_NAME)} 数据清理

用法:
  t-proxy clean              交互式清理本地配置、规则、证书与 Whistle 日志
  t-proxy clean --yes        跳过确认直接清理
  t-proxy clean --dry-run    仅列出将删除的路径

将清理（若存在）:
  - 配置目录（config.json、代理规则、HTTPS 证书）
  - Whistle 日志与运行时数据
  - Whistle 客户端 PID 文件

注意: 请先退出正在运行的 t-proxy，再执行清理。
`.trim();

export async function run(argv: string[]): Promise<void> {
	const yes = argv.includes("--yes") || argv.includes("-y");
	const dryRun = argv.includes("--dry-run");
	const help = argv.includes("--help") || argv.includes("-h");

	if (help || (argv.length > 0 && !yes && !dryRun && argv.some((a) => a.startsWith("-")))) {
		console.log(USAGE);
		if (argv.length > 0 && !help) {
			process.exitCode = 1;
		}
		return;
	}

	const targets = await listExistingCleanTargets();

	if (targets.length === 0) {
		console.log(chalk.green("✓ 无需清理，未找到 T-Proxy / Whistle 本地数据"));
		return;
	}

	console.log(chalk.bold(`${BRAND_NAME} 将清理以下路径:`));
	for (const target of targets) {
		console.log(`  ${chalk.dim("·")} ${target.label}`);
		console.log(`    ${chalk.dim(target.path)}`);
	}
	console.log("");

	if (dryRun) {
		console.log(chalk.yellow("dry-run 模式，未删除任何文件"));
		return;
	}

	try {
		await runClean({ yes, dryRun });
		console.log(chalk.green("✓ 清理完成"));
		console.log(chalk.dim("下次启动 t-proxy 将使用默认配置，HTTPS 证书需重新生成并安装"));
	} catch (err) {
		if (err instanceof Error && err.message === "已取消清理") {
			console.log(chalk.yellow("已取消"));
			return;
		}
		throw err;
	}
}

const invokedDirectly = process.argv[1]?.includes("clean/cli");
if (invokedDirectly) {
	run(process.argv.slice(2)).catch((err) => {
		console.error(chalk.red(`错误: ${formatError(err)}`));
		process.exit(1);
	});
}
