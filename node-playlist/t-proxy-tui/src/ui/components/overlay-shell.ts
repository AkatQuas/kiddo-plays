import chalk from "chalk";
import { Box, isFocusable, type Component, type Focusable } from "@earendil-works/pi-tui";

type InputTarget = Component & { handleInput?(data: string): void };

/**
 * Wraps overlay content so the overlay root and keyboard focus are the same component.
 * pi-tui only restores preFocus when focusedComponent === overlay.component.
 */
export class OverlayShell implements Component, Focusable {
	private _focused = false;

	constructor(
		private readonly view: Component,
		private readonly inputTarget: InputTarget,
		private readonly focusTarget?: Focusable,
	) {}

	static withBackground(content: InputTarget, focusTarget?: Focusable): OverlayShell {
		const box = new Box(1, 1, (t) => chalk.bgGray(t));
		box.addChild(content);
		const focusable = focusTarget ?? (isFocusable(content) ? content : undefined);
		return new OverlayShell(box, content, focusable);
	}

	get focused(): boolean {
		return this._focused;
	}

	set focused(value: boolean) {
		this._focused = value;
		if (this.focusTarget) {
			this.focusTarget.focused = value;
		}
	}

	handleInput(data: string): void {
		this.inputTarget.handleInput?.(data);
	}

	invalidate(): void {
		this.view.invalidate?.();
		this.inputTarget.invalidate?.();
	}

	render(width: number): string[] {
		return this.view.render(width);
	}
}
