import { RULES_HEADER_KEY } from "../config/constants.js";
import type { ProxyRule } from "../config/types.js";

export function buildRulesContent(rules: ProxyRule[]): string {
	const active = rules.filter((x) => x.open);
	const result = active.map((x) => {
		const from = x.from.split("?")[0];
		return [`${from} ${x.to}`, `${from} resHeaders://${RULES_HEADER_KEY}=${x.to}`].join("\n");
	});

	const cspArr = [
		...new Set(
			active
				.map((x) => {
					try {
						const { protocol, host } = new URL(x.from);
						return [`${protocol}//${host} disable://csp`, `${protocol}//${host} resCors://*`].join("\n");
					} catch {
						return null;
					}
				})
				.filter(Boolean),
		),
	];

	let rulesText = result.join("\n\n");
	if (cspArr.length) {
		rulesText += `\n\n# 域名通配\n${cspArr.join("\n")}\n`;
	}
	rulesText += "\n# 本地 host\ntproxy.local 127.0.0.1\n";
	rulesText +=
		"\n# react 资源\n/(.*)react/react.production.min.js,react-dom/react-dom.production.min.js(.*)/ $1react/react.development.js,react-dom/react-dom.development.js$2\n/(.*)js/react/react.production.min.js,js/react-dom/react-dom.production.min.js(.*)/ $1js/react/react.development.js,js/react-dom/react-dom.development.js$2\n";

	return rulesText;
}
