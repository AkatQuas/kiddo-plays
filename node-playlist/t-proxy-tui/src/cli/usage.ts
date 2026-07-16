import chalk from "chalk";
import { BRAND_NAME } from "../config/constants.js";
import { VERSION } from "../version.js";

export const MAIN_USAGE = `
${chalk.bold(BRAND_NAME)} v${VERSION} — terminal proxy manager

用法:
  t-proxy              启动 TUI 代理管理界面
  t-proxy cert <cmd>   证书管理（generate | install | show）
  t-proxy clean        清理配置、规则、证书与 Whistle 日志
  t-proxy help         显示帮助
  t-proxy --version    显示版本号

示例:
  t-proxy cert generate --force
  t-proxy cert install
  t-proxy clean --dry-run
  t-proxy clean --yes
`.trim();
