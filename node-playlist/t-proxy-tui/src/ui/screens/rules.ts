import chalk from "chalk";
import {
	Box,
	SelectList,
	type SelectItem,
	Spacer,
	Text,
} from "@earendil-works/pi-tui";
import { deleteRule, saveRule, toggleRule } from "../../config/index.js";
import { formatError } from "../../lib/errors.js";
import type { AppContext } from "../context.js";
import { OverlayForm } from "../components/overlay-form.js";
import { OverlayShell } from "../components/overlay-shell.js";
import { selectListTheme } from "../themes.js";

export function renderRules(ctx: AppContext): void {
	const { tui, contentBox, state } = ctx;
	contentBox.clear();

	const items: SelectItem[] = state.rules.map((r) => ({
		value: r.from,
		label: `${r.open ? chalk.green("●") : chalk.dim("○")} ${r.from}`,
		description: `→ ${r.to}`,
	}));

	items.unshift({ value: "__add__", label: chalk.cyan("+ 添加规则"), description: "Enter 添加新转发规则" });
	items.unshift({ value: "__back__", label: chalk.dim("← 返回"), description: "" });

	const list = new SelectList(items, Math.min(12, items.length), selectListTheme);
	list.onSelect = (item) => {
		if (item.value === "__back__") {
			ctx.navigate.home();
			return;
		}
		if (item.value === "__add__") {
			showAddRuleOverlay(ctx);
			return;
		}
		showRuleActionsOverlay(ctx, item.value);
	};
	list.onCancel = () => ctx.navigate.home();

	contentBox.addChild(new Text(chalk.bold("代理规则"), 0, 0));
	contentBox.addChild(new Spacer(1));
	contentBox.addChild(list);
	tui.setFocus(list);
}

function showRuleActionsOverlay(ctx: AppContext, from: string): void {
	const rule = ctx.state.rules.find((r) => r.from === from);
	if (!rule) return;

	const items: SelectItem[] = [
		{
			value: "toggle",
			label: rule.open ? "关闭规则" : "开启规则",
			description: rule.open ? "暂停此转发" : "启用此转发",
		},
		{ value: "delete", label: chalk.red("删除规则"), description: "永久删除" },
		{ value: "cancel", label: "取消", description: "" },
	];

	const list = new SelectList(items, 5, selectListTheme);
	list.onSelect = async (item) => {
		ctx.hideOverlay();
		try {
			if (item.value === "toggle") {
				toggleRule(from, !rule.open);
				ctx.refreshRules();
				if (ctx.state.status.running) await ctx.syncRulesToWhistle();
				ctx.setMessage(rule.open ? "规则已关闭" : "规则已开启");
			} else if (item.value === "delete") {
				deleteRule(from);
				ctx.refreshRules();
				if (ctx.state.status.running) await ctx.syncRulesToWhistle();
				ctx.setMessage("规则已删除");
			}
			renderRules(ctx);
		} catch (err) {
			ctx.setMessage(`错误: ${formatError(err)}`);
		}
		ctx.requestRender();
	};
	list.onCancel = () => {
		ctx.hideOverlay();
		ctx.requestRender();
	};

	const panel = new Box(1, 1, (t) => chalk.bgGray(t));
	panel.addChild(new Text(chalk.bold(rule.from), 0, 0));
	panel.addChild(new Spacer(1));
	panel.addChild(list);

	const shell = new OverlayShell(panel, list);

	ctx.setOverlay(ctx.tui.showOverlay(shell, { width: "80%", maxHeight: 10, anchor: "center" }));
	ctx.tui.setFocus(shell);
}

function showAddRuleOverlay(ctx: AppContext): void {
	const form = new OverlayForm({
		title: "添加代理规则",
		fields: [
			{ label: "被代理地址 (from)" },
			{ label: "转发到 (to)" },
		],
		secondaryLabel: "清空",
		onConfirm: ([from, to]) => {
			const trimmedFrom = from.trim();
			const trimmedTo = to.trim();
			if (!trimmedFrom || !trimmedTo) {
				ctx.setMessage("请填写完整地址");
				ctx.requestRender();
				return;
			}
			ctx.hideOverlay();
			try {
				const res = saveRule({ from: trimmedFrom, to: trimmedTo, open: true, type: "add" });
				if (!res.success) {
					ctx.setMessage(res.msg ?? "添加失败");
					return;
				}
				ctx.refreshRules();
				if (ctx.state.status.running) void ctx.syncRulesToWhistle();
				ctx.setMessage("规则已添加");
				renderRules(ctx);
			} catch (err) {
				ctx.setMessage(`错误: ${formatError(err)}`);
			}
			ctx.requestRender();
		},
		onSecondary: () => form.clearFields(),
		onCancel: () => {
			ctx.hideOverlay();
			ctx.requestRender();
		},
		requestRender: () => ctx.requestRender(),
	});

	const shell = OverlayShell.withBackground(form, form);

	ctx.setOverlay(ctx.tui.showOverlay(shell, { width: "85%", maxHeight: 18, anchor: "center" }));
	ctx.tui.setFocus(shell);
}
