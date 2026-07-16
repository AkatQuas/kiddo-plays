import chalk from "chalk";
import { Spacer, Text, type Component, type Focusable } from "@earendil-works/pi-tui";
import { Key, matchesKey } from "@earendil-works/pi-tui";
import { Button } from "./button.js";
import { FieldInput } from "./field-input.js";
import { FocusRing } from "./focus-ring.js";

export interface OverlayFormField {
	label: string;
	initialValue?: string;
}

export interface OverlayFormOptions {
	title: string;
	hint?: string;
	fields: OverlayFormField[];
	confirmLabel?: string;
	secondaryLabel: string;
	onConfirm(values: string[]): void;
	onSecondary(): void;
	onCancel(): void;
	requestRender(): void;
}

export class OverlayForm implements Component, Focusable {
	private _focused = false;

	private readonly fields: FieldInput[];
	readonly confirmButton: Button;
	readonly secondaryButton: Button;
	private readonly ring: FocusRing;

	constructor(private readonly options: OverlayFormOptions) {
		this.fields = options.fields.map((field) => {
			const input = new FieldInput(field.label);
			if (field.initialValue) {
				input.setValue(field.initialValue);
			}
			return input;
		});

		this.confirmButton = new Button(options.confirmLabel ?? "确认", () => this.submit());
		this.secondaryButton = new Button(options.secondaryLabel, () => {
			options.onSecondary();
			options.requestRender();
		});

		this.ring = new FocusRing([
			...this.fields,
			this.confirmButton,
			this.secondaryButton,
		]);
	}

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		this.ring.setParentFocused(value);
	}

	getValues(): string[] {
		return this.fields.map((field) => field.getValue());
	}

	clearFields(): void {
		for (const field of this.fields) {
			field.setValue("");
		}
		this.ring.focusFirst();
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape)) {
			this.options.onCancel();
			return;
		}
		if (this.ring.handleInput(data)) {
			this.options.requestRender();
		}
	}

	invalidate(): void {
		for (const field of this.fields) {
			field.invalidate();
		}
		this.confirmButton.invalidate();
		this.secondaryButton.invalidate();
	}

	render(width: number): string[] {
		const lines: string[] = [];
		const push = (component: Component) => {
			for (const line of component.render(width)) {
				lines.push(line);
			}
		};

		push(new Text(chalk.bold(this.options.title), 0, 0));
		if (this.options.hint) {
			push(new Spacer(1));
			push(new Text(chalk.dim(this.options.hint), 0, 0));
		}
		for (const field of this.fields) {
			push(new Spacer(1));
			push(field);
		}
		push(new Spacer(1));
		lines.push(`${this.confirmButton.render()[0]!}  ${this.secondaryButton.render()[0]!}`);
		push(new Spacer(1));
		push(
			new Text(
				chalk.dim("Tab / Shift+Tab 切换焦点 · Enter 确认或执行按钮 · Esc 取消"),
				0,
				0,
			),
		);

		return lines;
	}

	private submit(): void {
		this.options.onConfirm(this.getValues());
	}
}
