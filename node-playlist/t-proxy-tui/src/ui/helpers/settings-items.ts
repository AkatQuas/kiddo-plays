import type { SettingItem } from "@earendil-works/pi-tui";

/**
 * SettingsList only invokes onChange when an item has `values` or `submenu`.
 * Action items need a single-value `values` array so Enter/Space triggers the handler.
 */
export function actionItem(
	id: string,
	label: string,
	currentValue: string,
	description?: string,
): SettingItem {
	return { id, label, description, currentValue, values: [currentValue, currentValue] };
}

export function toggleItem(
	id: string,
	label: string,
	running: boolean,
	description: string,
): SettingItem {
	return {
		id,
		label,
		description,
		currentValue: running ? "开启" : "关闭",
		values: running ? ["关闭", "开启"] : ["开启", "关闭"],
	};
}
