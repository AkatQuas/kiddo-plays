import chalk from "chalk";
import { Input, type Component, type Focusable } from "@earendil-works/pi-tui";

export class FieldInput implements Component, Focusable {
	private _focused = false;

	readonly input = new Input();

	constructor(readonly label: string) {}

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		this.input.focused = value;
	}

	getValue(): string {
		return this.input.getValue();
	}

	setValue(value: string): void {
		this.input.setValue(value);
	}

	handleInput(data: string): void {
		this.input.handleInput(data);
	}

	invalidate(): void {
		this.input.invalidate();
	}

	render(width: number): string[] {
		const labelLine = this._focused
			? chalk.cyan.bold(`● ${this.label}`)
			: chalk.dim(`○ ${this.label}`);

		const indent = "   ";
		const contentWidth = Math.max(1, width - indent.length - 2);
		let fieldLine: string;

		if (this._focused) {
			const raw = this.input.render(contentWidth)[0] ?? "";
			const body = raw.startsWith("> ") ? raw.slice(2) : raw;
			fieldLine = indent + chalk.cyan("▸ ") + chalk.bgGray.white(body);
		} else {
			const value = this.input.getValue();
			fieldLine = value
				? indent + chalk.dim(value)
				: indent + chalk.dim.italic("(未填写)");
		}

		return [labelLine, fieldLine];
	}
}
