import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

export async function confirm(message: string): Promise<boolean> {
	if (!stdin.isTTY) {
		return false;
	}

	const rl = readline.createInterface({ input: stdin, output: stdout });
	try {
		const answer = await rl.question(`${message} [y/N] `);
		return /^y(es)?$/i.test(answer.trim());
	} finally {
		rl.close();
	}
}
