import { homedir } from "node:os";
import path from "node:path";

export const WHISTLE_PROC_PATH = path.join(homedir(), ".whistle_client.pid");
