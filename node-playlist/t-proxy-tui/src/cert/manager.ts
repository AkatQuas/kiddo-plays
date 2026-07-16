import { createRequire } from "node:module";
import path from "node:path";
import fs from "fs-extra";
import {
	BRAND_NAME,
	LOCALHOST,
	getPort,
	getCertsDir,
	getRootCertPath,
	getRootKeyPath,
	getWhistleCertsDir,
	markCertInstalled,
} from "../config/index.js";

const require = createRequire(import.meta.url);

function loadWhistleCA() {
	const whistleRoot = path.dirname(require.resolve("whistle"));
	return require(path.join(whistleRoot, "lib/https/ca")) as {
		createRootCA: (opts?: Record<string, string>) => { cert: string; key: string };
		getRootCAFile: () => string;
	};
}

export interface CertInfo {
	certPath: string;
	keyPath: string;
	whistleCertPath: string;
	exists: boolean;
}

export function getCertInfo(): CertInfo {
	const certPath = getRootCertPath();
	const keyPath = getRootKeyPath();
	const whistleCertPath = path.join(getWhistleCertsDir(), "root.crt");
	return {
		certPath,
		keyPath,
		whistleCertPath,
		exists: fs.existsSync(certPath) && fs.existsSync(keyPath),
	};
}

async function writeCertFiles(cert: string, key: string): Promise<CertInfo> {
	const certsDir = getCertsDir();
	const whistleCertsDir = getWhistleCertsDir();
	await fs.ensureDir(certsDir);
	await fs.ensureDir(whistleCertsDir);

	const certPath = getRootCertPath();
	const keyPath = getRootKeyPath();

	await Promise.all([
		fs.writeFile(certPath, cert, "utf8"),
		fs.writeFile(keyPath, key, "utf8"),
		fs.writeFile(path.join(whistleCertsDir, "root.crt"), cert, "utf8"),
		fs.writeFile(path.join(whistleCertsDir, "root.key"), key, "utf8"),
	]);

	// Whistle 可能缓存了 root_new.*，清理以便重新加载
	await Promise.all([
		fs.remove(path.join(whistleCertsDir, "root_new.crt")).catch(() => {}),
		fs.remove(path.join(whistleCertsDir, "root_new.key")).catch(() => {}),
	]);

	return getCertInfo();
}

export async function generateRootCA(force = false): Promise<CertInfo> {
	const info = getCertInfo();
	if (info.exists && !force) {
		throw new Error("证书已存在，使用 --force 强制重新生成");
	}

	const ca = loadWhistleCA();
	const result = ca.createRootCA({
		commonName: `${BRAND_NAME} Root CA`,
		organizationName: BRAND_NAME,
		organizationalUnit: "MITM Proxy",
	});

	return writeCertFiles(result.cert, result.key);
}

export async function ensureRootCA(): Promise<CertInfo> {
	const info = getCertInfo();
	if (info.exists) {
		return info;
	}
	return generateRootCA(false);
}

export async function installRootCA(certPath?: string): Promise<void> {
	const install = require("whistle/bin/ca/index") as (file: string) => void;
	const file = certPath ?? getRootCertPath();

	if (!fs.existsSync(file)) {
		await ensureRootCA();
	}

	install(fs.existsSync(file) ? file : getRootCertPath());
	markCertInstalled();
}

export async function installRootCAFromWhistle(): Promise<void> {
	const installCli = require("whistle/bin/ca/cli") as (argv: string[]) => void;
	installCli([`http://${LOCALHOST}:${getPort()}`]);
	markCertInstalled();
}
