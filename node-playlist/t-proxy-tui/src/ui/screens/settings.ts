import chalk from "chalk";
import {
	SettingsList,
	Spacer,
	Text,
} from "@earendil-works/pi-tui";
import { isCertMarkedInstalled, saveWhitelist } from "../../config/index.js";
import { ensureRootCA, generateRootCA, getCertInfo, installRootCA } from "../../cert/manager.js";
import { formatError } from "../../lib/errors.js";
import type { AppContext } from "../context.js";
import { actionItem } from "../helpers/settings-items.js";
import { OverlayForm } from "../components/overlay-form.js";
import { OverlayShell } from "../components/overlay-shell.js";
import { settingsListTheme } from "../themes.js";

export function renderSettings(ctx: AppContext): void {
	const { tui, contentBox, state } = ctx;
	contentBox.clear();

	const certInfo = getCertInfo();
	const certStatus = isCertMarkedInstalled()
		? chalk.green("已安装")
		: certInfo.exists
			? chalk.yellow("已生成")
			: chalk.red("未生成");

	const whitelistPreview =
		state.whitelist.length > 30 ? `${state.whitelist.slice(0, 30)}…` : state.whitelist || "(空)";

	const items = [
		actionItem("cert-install", "HTTPS 证书", certStatus, "安装根证书到系统信任库，HTTPS 代理解密必需"),
		actionItem(
			"cert-generate",
			"重新生成证书",
			certInfo.exists ? "重新生成" : "生成",
			"生成新的根证书（需重新安装到系统）",
		),
		actionItem("cert-show", "证书路径", "查看", certInfo.certPath),
		actionItem("whitelist", "代理白名单", whitelistPreview, "白名单内域名不走代理，修改后需重启代理"),
		actionItem("back", "返回", "‹", "返回主菜单"),
	];

	const list = new SettingsList(
		items,
		8,
		settingsListTheme,
		async (id) => {
			try {
				if (id === "cert-install") {
					ctx.setMessage("正在安装 HTTPS 证书...");
					await ensureRootCA();
					await installRootCA();
					ctx.setMessage("HTTPS 证书已安装，请重启浏览器");
					renderSettings(ctx);
					return;
				}
				if (id === "cert-generate") {
					ctx.setMessage("正在生成 HTTPS 根证书...");
					await generateRootCA(true);
					ctx.setMessage("证书已重新生成，请重新安装到系统");
					renderSettings(ctx);
					return;
				}
				if (id === "cert-show") {
					const info = getCertInfo();
					ctx.setMessage(`cert: ${info.certPath}`);
				} else if (id === "whitelist") {
					showWhitelistOverlay(ctx);
					return;
				} else if (id === "back") {
					ctx.navigate.home();
					return;
				}
			} catch (err) {
				ctx.setMessage(`错误: ${formatError(err)}`);
				renderSettings(ctx);
				return;
			}
			ctx.requestRender();
		},
		() => ctx.navigate.home(),
	);

	contentBox.addChild(new Text(chalk.bold("设置"), 0, 0));
	contentBox.addChild(new Spacer(1));
	contentBox.addChild(list);
	tui.setFocus(list);
}

function showWhitelistOverlay(ctx: AppContext): void {
	const form = new OverlayForm({
		title: "代理白名单",
		hint: "逗号分隔，支持 *.domain.com，修改后需重启代理",
		fields: [{ label: "白名单", initialValue: ctx.state.whitelist }],
		secondaryLabel: "取消",
		onConfirm: ([whitelist]) => {
			ctx.hideOverlay();
			try {
				ctx.state.whitelist = whitelist;
				saveWhitelist(whitelist);
				ctx.setMessage("白名单已保存，如代理已开启请重启代理");
				renderSettings(ctx);
			} catch (err) {
				ctx.setMessage(`错误: ${formatError(err)}`);
			}
			ctx.requestRender();
		},
		onSecondary: () => {
			ctx.hideOverlay();
			ctx.requestRender();
		},
		onCancel: () => {
			ctx.hideOverlay();
			ctx.requestRender();
		},
		requestRender: () => ctx.requestRender(),
	});

	const shell = OverlayShell.withBackground(form, form);

	ctx.setOverlay(ctx.tui.showOverlay(shell, { width: "85%", maxHeight: 12, anchor: "center" }));
	ctx.tui.setFocus(shell);
}
