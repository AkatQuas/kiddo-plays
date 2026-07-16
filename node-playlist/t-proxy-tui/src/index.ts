#!/usr/bin/env node
import chalk from "chalk";
import { MAIN_USAGE } from "./cli/usage.js";
import { formatError } from "./lib/errors.js";
import { VERSION } from "./version.js";

async function main(): Promise<void> {
	const [subcommand, ...rest] = process.argv.slice(2);

	if (subcommand === "--version" || subcommand === "-V") {
		console.log(VERSION);
		return;
	}

	if (subcommand === "cert") {
		const { run } = await import("./cert/cli.js");
		await run(rest);
		return;
	}

	if (subcommand === "clean") {
		const { run } = await import("./clean/cli.js");
		await run(rest);
		return;
	}

	if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
		console.log(MAIN_USAGE);
		return;
	}

	if (!subcommand) {
		const { runApp } = await import("./ui/app.js");
		await runApp();
		return;
	}

	console.error(chalk.red(`未知命令: ${subcommand}`));
	console.log(MAIN_USAGE);
	process.exitCode = 1;
}

main().catch((err) => {
	console.error(chalk.red(`错误: ${formatError(err)}`));
	process.exit(1);
});
