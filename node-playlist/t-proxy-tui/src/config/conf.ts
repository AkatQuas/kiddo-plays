import Conf from "conf";
import {
	DEFAULT_PORT,
	DEFAULT_PROXY_WHITELIST,
	LOCALHOST,
	PROJECT_NAME,
} from "./constants.js";
import type { TProxyConfig } from "./types.js";

const schema = {
	proxyWhitelist: {
		type: "string",
		default: DEFAULT_PROXY_WHITELIST,
	},
	port: {
		type: "number",
		default: DEFAULT_PORT,
	},
	host: {
		type: "string",
		default: LOCALHOST,
	},
	rules: {
		type: "array",
		default: [],
	},
	certInstalledAt: {
		type: "string",
	},
} as const;

export const config = new Conf<TProxyConfig>({
	projectName: PROJECT_NAME,
	schema,
});
