import { fork, type ChildProcess } from "node:child_process";
import http from "node:http";
import fs from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALHOST, WHISTLE_PROJECT_NAME, getPort } from "../config/index.js";
import { WHISTLE_PROC_PATH } from "../lib/whistle-paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WHISTLE_SCRIPT = path.join(__dirname, "whistle-worker.js");

let child: ChildProcess | null = null;
let whistleOptions: { port: number; host: string; specialAuth?: string } | null = null;

export function getWhistleOptions() {
	return whistleOptions;
}

export async function startWhistle(): Promise<void> {
	if (child) return;

	const args = [
		encodeURIComponent(
			JSON.stringify({
				host: "0.0.0.0",
				port: getPort(),
			}),
		),
	];

	return new Promise((resolve, reject) => {
		child = fork(WHISTLE_SCRIPT, args, {
			execArgv: [
				"--max-semi-space-size=64",
				"--max-http-header-size=256000",
				"--tls-min-v1.0",
			],
			stdio: ["pipe", "pipe", "pipe", "ipc"],
		});

		const timeout = setTimeout(() => reject(new Error("Whistle 启动超时")), 30000);

		child.on("message", (data: { type?: string; message?: string; options?: typeof whistleOptions }) => {
			if (data?.type === "options") {
				whistleOptions = data.options ?? null;
				clearTimeout(timeout);
				resolve();
				return;
			}
			if (data?.type === "error") {
				clearTimeout(timeout);
				reject(new Error(data.message ?? "Whistle 启动失败"));
			}
		});

		let stderr = "";
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		child.on("error", (err) => {
			clearTimeout(timeout);
			reject(err);
		});

		child.once("exit", (code) => {
			if (code !== 0 && code !== null && !whistleOptions) {
				clearTimeout(timeout);
				const detail = stderr.trim() ? `\n${stderr.trim()}` : "";
				reject(
					new Error(
						`Whistle 进程退出 (code ${code})，端口 ${getPort()} 可能已被占用${detail}`,
					),
				);
			}
		});
	});
}

export async function stopWhistleChild(): Promise<void> {
	await stopChildProcess();
	cleanupProcFile();
	whistleOptions = null;
}

function stopChildProcess(): Promise<void> {
	const proc = child;
	if (!proc) return Promise.resolve();

	const procPid = proc.pid;
	child = null;
	proc.removeAllListeners();

	return new Promise((resolve) => {
		const finish = () => {
			cleanupStaleProcPid(procPid);
			resolve();
		};

		const timeout = setTimeout(() => {
			try {
				proc.kill("SIGTERM");
			} catch {
				// ignore
			}
			finish();
		}, 1500);

		proc.once("exit", () => {
			clearTimeout(timeout);
			finish();
		});

		try {
			proc.send?.({ type: "exitWhistle" });
		} catch {
			clearTimeout(timeout);
			try {
				proc.kill("SIGTERM");
			} catch {
				// ignore
			}
			finish();
		}
	});
}

function cleanupProcFile(): void {
	try {
		fs.unlinkSync(WHISTLE_PROC_PATH);
	} catch {
		// ignore
	}
}

function cleanupStaleProcPid(alivePid?: number): void {
	try {
		const pid = Number(fs.readFileSync(WHISTLE_PROC_PATH, { encoding: "utf-8" }).split(",")[0]);
		if (pid && pid !== alivePid) {
			try {
				process.kill(pid, "SIGTERM");
			} catch {
				// already gone
			}
		}
	} catch {
		// ignore
	}
}

export async function pushRulesToWhistle(rules: string): Promise<void> {
	const options = whistleOptions ?? { port: getPort(), host: LOCALHOST };
	const body = [
		"name=" + encodeURIComponent(WHISTLE_PROJECT_NAME),
		"rules=" + encodeURIComponent(rules),
		"groupName=",
	].join("&");

	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				hostname: options.host || LOCALHOST,
				port: options.port,
				path: "/cgi-bin/rules/project",
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
					...(options.specialAuth ? { "x-whistle-special-auth": options.specialAuth } : {}),
				},
			},
			(res) => {
				let data = "";
				res.on("data", (chunk) => (data += chunk));
				res.on("end", () => {
					if (res.statusCode === 200) resolve();
					else reject(new Error(data || `Whistle rules error: ${res.statusCode}`));
				});
			},
		);
		req.on("error", reject);
		req.end(body);
	});
}
