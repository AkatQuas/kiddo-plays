#!/usr/bin/env node
import chalk from "chalk";
import {
	ensureRootCA,
	generateRootCA,
	getCertInfo,
	installRootCA,
	installRootCAFromWhistle,
} from "./manager.js";
import { BRAND_NAME, getConfigDir } from "../config/index.js";
import { formatError } from "../lib/errors.js";

const USAGE = `
${chalk.bold(BRAND_NAME)} 证书管理

用法:
  t-proxy cert generate [--force]   生成 HTTPS 根证书（MITM 解密用）
  t-proxy cert install              安装根证书到系统信任库
  t-proxy cert install --remote     从运行中的 Whistle 下载并安装
  t-proxy cert show                 显示证书路径

npm 脚本:
  npm run cert:generate [-- --force]
  npm run cert:install
  npm run cert:show
`.trim();

export async function run(argv: string[]): Promise<void> {
	const [command, ...rest] = argv;
	const force = rest.includes("--force");
	const remote = rest.includes("--remote");

	switch (command) {
		case "generate": {
			const info = await generateRootCA(force);
			console.log(chalk.green("✓ 根证书已生成"));
			console.log(`  cert: ${info.certPath}`);
			console.log(`  key:  ${info.keyPath}`);
			console.log(chalk.dim("\n请运行 `t-proxy cert install` 将证书安装到系统信任库"));
			break;
		}
		case "install": {
			if (remote) {
				await installRootCAFromWhistle();
			} else {
				await ensureRootCA();
				await installRootCA();
			}
			console.log(chalk.green("✓ 根证书已安装到系统信任库"));
			console.log(chalk.dim("HTTPS 代理现已可用，如已开启代理请重启浏览器"));
			break;
		}
		case "show": {
			const info = getCertInfo();
			console.log(chalk.bold(`${BRAND_NAME} 证书`));
			console.log(`  配置目录: ${getConfigDir()}`);
			console.log(`  cert:     ${info.certPath}`);
			console.log(`  key:      ${info.keyPath}`);
			console.log(`  whistle:  ${info.whistleCertPath}`);
			console.log(`  状态:     ${info.exists ? chalk.green("已生成") : chalk.yellow("未生成")}`);
			break;
		}
		default:
			console.log(USAGE);
			if (command) {
				process.exitCode = 1;
			}
	}
}

const invokedDirectly = process.argv[1]?.includes("cert/cli");
if (invokedDirectly) {
	run(process.argv.slice(2)).catch((err) => {
		console.error(chalk.red(`错误: ${formatError(err)}`));
		process.exit(1);
	});
}
