import { Key, matchesKey, type Component, type Focusable } from "@earendil-works/pi-tui";

export type FocusableControl = Component & Focusable;

export class FocusRing {
	private index = 0;
	private parentFocused = false;

	constructor(private readonly controls: FocusableControl[]) {}

	setParentFocused(focused: boolean): void {
		this.parentFocused = focused;
		this.sync();
	}

	get activeIndex(): number {
		return this.index;
	}

	focusNext(): void {
		if (this.controls.length === 0) return;
		this.index = (this.index + 1) % this.controls.length;
		this.sync();
	}

	focusPrevious(): void {
		if (this.controls.length === 0) return;
		this.index = (this.index - 1 + this.controls.length) % this.controls.length;
		this.sync();
	}

	focusFirst(): void {
		this.index = 0;
		this.sync();
	}

	getActive(): FocusableControl | undefined {
		return this.controls[this.index];
	}

	handleInput(data: string): boolean {
		if (matchesKey(data, Key.tab)) {
			this.focusNext();
			return true;
		}
		if (matchesKey(data, Key.shift("tab"))) {
			this.focusPrevious();
			return true;
		}
		const active = this.getActive();
		active?.handleInput?.(data);
		return true;
	}

	private sync(): void {
		for (let i = 0; i < this.controls.length; i++) {
			this.controls[i]!.focused = this.parentFocused && i === this.index;
		}
	}
}
