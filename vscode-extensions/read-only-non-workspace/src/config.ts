import * as vscode from 'vscode';

export const EXTENSION_NAME = "read-only.non-workspaceFiles";

export interface DecoratorSettings {
  enableReadonly: boolean,
};


export async function getSettings(): Promise<DecoratorSettings> {

  const config: vscode.WorkspaceConfiguration | undefined = vscode.workspace.getConfiguration(EXTENSION_NAME);

  let enableReadonly: boolean = await config.get('enable') ?? false;

  return {
    enableReadonly
  };
}
