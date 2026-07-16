import chalk from "chalk";
import { Key, matchesKey, type Component, type Focusable } from "@earendil-works/pi-tui";

export class Button implements Component, Focusable {
	focused = false;

	constructor(
		readonly label: string,
		readonly onPress?: () => void,
	) {}

	handleInput(data: string): void {
		if (matchesKey(data, Key.enter) || matchesKey(data, Key.space) || data === " ") {
			this.onPress?.();
		}
	}

	invalidate(): void {}

	render(): string[] {
		if (this.focused) {
			return [chalk.black.bgCyan(` ${this.label} `)];
		}
		return [chalk.cyan(` ${this.label} `)];
	}
}
