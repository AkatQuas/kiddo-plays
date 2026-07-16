import chalk from "chalk";
import {
	Box,
	Input,
	SelectList,
	type SelectItem,
	SettingsList,
	Spacer,
	Text,
} from "@earendil-works/pi-tui";
import {
	BRAND_NAME,
	LOCALHOST,
	getPort,
	isCertMarkedInstalled,
	type ProxyRule,
} from "../../config/index.js";
import { getCertInfo } from "../../cert/manager.js";
import { openInBrowser } from "../../lib/open-browser.js";
import { formatError } from "../../lib/errors.js";
import { restartProxy, startProxy, stopProxy } from "../../proxy/whistle-manager.js";
import type { AppContext } from "../context.js";
import { actionItem, toggleItem } from "../helpers/settings-items.js";
import { requestShutdown } from "../shutdown.js";
import { settingsListTheme } from "../themes.js";

export function renderHome(ctx: AppContext): void {
	const { tui, contentBox, state } = ctx;
	contentBox.clear();

	const activeRules = state.rules.filter((r: ProxyRule) => r.open).length;

	const items = [
		toggleItem(
			"toggle",
			"系统代理",
			state.status.running,
			state.status.running
				? "关闭系统 HTTP/HTTPS 代理"
				: `将系统代理指向 Whistle (${LOCALHOST}:${getPort()})`,
		),
		actionItem("restart", "重启代理", "执行", "先关闭再重新设置系统代理（白名单变更后需重启）"),
		actionItem(
			"rules",
			"代理规则",
			`${state.rules.length} 条`,
			`管理 URL 转发规则，当前 ${activeRules}/${state.rules.length} 条启用`,
		),
		actionItem("settings", "设置", "›", "白名单、HTTPS 证书等配置"),
		actionItem("panel", "Whistle 面板", "打开", "在浏览器打开 Whistle 管理面板"),
		actionItem("quit", "退出", "退出", "关闭系统代理并停止 Whistle"),
	];

	const list = new SettingsList(
		items,
		8,
		settingsListTheme,
		async (id, newValue) => {
			try {
				if (id === "toggle") {
					const enable = newValue === "开启";
					ctx.setMessage(enable ? "正在开启系统代理..." : "正在关闭系统代理...");
					if (enable) {
						if (!isCertMarkedInstalled() && !getCertInfo().exists) {
							ctx.setMessage("建议先安装 HTTPS 证书（设置 → HTTPS 证书）");
						}
						await ctx.syncRulesToWhistle();
						await startProxy();
					} else {
						await stopProxy();
					}
					await ctx.refreshStatus();
					ctx.setMessage(enable ? "系统代理已开启" : "系统代理已关闭");
				} else if (id === "restart") {
					ctx.setMessage("正在重启代理...");
					await restartProxy();
					await ctx.syncRulesToWhistle();
					await ctx.refreshStatus();
					ctx.setMessage("代理已重启");
				} else if (id === "rules") {
					ctx.navigate.rules();
					return;
				} else if (id === "settings") {
					ctx.navigate.settings();
					return;
				} else if (id === "panel") {
					openInBrowser(`http://127.0.0.1:${getPort()}`);
					ctx.setMessage("已在浏览器打开 Whistle 面板");
				} else if (id === "quit") {
					ctx.setMessage("正在退出...");
					ctx.requestRender();
					requestShutdown(ctx.shutdown, 0);
					return;
				}
			} catch (err) {
				await ctx.refreshStatus();
				ctx.setMessage(`错误: ${formatError(err)}`);
				renderHome(ctx);
				return;
			}
			renderHome(ctx);
			ctx.requestRender();
		},
		() => {},
	);

	contentBox.addChild(new Text(chalk.bold(BRAND_NAME), 0, 0));
	contentBox.addChild(new Spacer(1));
	contentBox.addChild(list);
	tui.setFocus(list);
}
