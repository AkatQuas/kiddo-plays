import { singleton } from "tsyringe";
import { env, Uri, workspace } from "vscode";
import { EXT_NAME } from "./constant";

export interface VSCodeConfig {
  enableDebugLogs: boolean;
}

@singleton()
export class ExtConfig {
  getByUri(uri?: Uri) {
    const config = workspace.getConfiguration(
      EXT_NAME,
      uri
    ) as unknown as VSCodeConfig;

    if (workspace.isTrusted) {
      return config;
    }

    // Some settings are disabled for untrusted workspaces
    // because they can be used for bad things.
    const newConfig: VSCodeConfig = {
      ...config,
      enableDebugLogs: false,
    };
    return newConfig;
  }
}
