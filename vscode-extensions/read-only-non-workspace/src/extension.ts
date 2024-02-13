import * as vscode from 'vscode';
import { DecoratorSettings, EXTENSION_NAME, getSettings } from './config';
import {
  isNonWorkspace,
  setTabToReadOnly,
  setTabsToReadOnly,
} from './processTabs';

export async function activate(context: vscode.ExtensionContext) {
  console.debug('\x1B[97;100;1m --- hello world --- \x1B[m', '\n');
  const settingsObject: DecoratorSettings = await getSettings();
  let tabGroups: vscode.TabGroups = vscode.window.tabGroups;

  if (settingsObject.enableReadonly) {
    await setTabsToReadOnly(tabGroups);
  }

  // ---------------------------------------------------------------------------------------------

  vscode.workspace.onDidOpenTextDocument((event) => {
    console.log();
  });

  vscode.window.onDidChangeActiveTextEditor(async (event) => {
    const Uri = event?.document?.uri;
    if (Uri && (await isNonWorkspace(Uri))) setTabToReadOnly(Uri, true);
  });

  // ---------------------------------------------------------------------------------------------

  const configChange = vscode.workspace.onDidChangeConfiguration(
    async (event) => {
      if (event.affectsConfiguration(EXTENSION_NAME)) {
        // = "read-only.non-workspaceFiles"

        const settingsObject: DecoratorSettings = await getSettings();
        if (settingsObject.enableReadonly) {
          const tabGroups: vscode.TabGroups = vscode.window.tabGroups;
          await setTabsToReadOnly(tabGroups);
        }
      }
    }
  );

  context.subscriptions.push(configChange);
}

export function deactivate() {}
