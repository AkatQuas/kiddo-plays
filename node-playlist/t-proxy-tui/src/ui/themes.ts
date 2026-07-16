import type { SelectListTheme, SettingsListTheme } from "@earendil-works/pi-tui";
import { Chalk } from "chalk";

const chalk = new Chalk({ level: 3 });

export const selectListTheme: SelectListTheme = {
	selectedPrefix: (text) => chalk.cyan(text),
	selectedText: (text) => chalk.bold(text),
	description: (text) => chalk.dim(text),
	scrollInfo: (text) => chalk.dim(text),
	noMatch: (text) => chalk.dim(text),
};

export const settingsListTheme: SettingsListTheme = {
	label: (text, selected) => (selected ? chalk.bold.cyan(text) : text),
	value: (text, selected) => (selected ? chalk.green(text) : chalk.dim(text)),
	description: (text) => chalk.dim(text),
	cursor: chalk.cyan("›"),
	hint: (text) => chalk.dim(text),
};
