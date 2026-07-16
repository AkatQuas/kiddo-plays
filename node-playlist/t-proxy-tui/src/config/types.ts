export interface ProxyRule {
	from: string;
	to: string;
	open: boolean;
}

export interface TProxyConfig {
	proxyWhitelist: string;
	port: number;
	host: string;
	rules: ProxyRule[];
	certInstalledAt?: string;
}

export interface AppConfigSnapshot {
	proxyWhitelist: string;
	port: number;
	host: string;
}
