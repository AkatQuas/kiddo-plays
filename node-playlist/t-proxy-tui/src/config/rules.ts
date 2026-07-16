import { config } from "./conf.js";
import type { ProxyRule } from "./types.js";

export type SaveRuleResult = { success: true } | { success: false; msg: string };

export function getRules(): ProxyRule[] {
	return config.get("rules");
}

export function setRules(rules: ProxyRule[]): void {
	config.set("rules", rules);
}

export function saveWhitelist(value: string): void {
	config.set("proxyWhitelist", value);
}

export function saveRule(rule: ProxyRule & { type?: "add" | "edit" }): SaveRuleResult {
	const data = getRules();
	if (rule.type === "add" && data.some((x) => x.from === rule.from)) {
		return { success: false, msg: "代理规则已存在" };
	}
	const index = data.findIndex((x) => x.from === rule.from);
	const entry: ProxyRule = { from: rule.from, to: rule.to, open: rule.open };
	if (index === -1) {
		setRules([entry, ...data]);
	} else {
		const next = [...data];
		next[index] = { ...next[index], ...entry };
		setRules(next);
	}
	return { success: true };
}

export function deleteRule(from: string): void {
	setRules(getRules().filter((x) => x.from !== from));
}

export function toggleRule(from: string, open: boolean): void {
	const data = getRules();
	const item = data.find((x) => x.from === from);
	if (!item) return;
	item.open = open;
	setRules([...data]);
}
