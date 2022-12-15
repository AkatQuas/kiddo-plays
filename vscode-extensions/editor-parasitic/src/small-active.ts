import * as vscode from 'vscode';

export const smallActive = (
  context: vscode.ExtensionContext,
  appendLog: (s: string) => void
) => {
  appendLog(
    `Congratulations, active running at vscode version ${vscode.version}`
  );
  appendLog(`${context.storagePath}`);
  appendLog(`${context.storageUri}`);
  appendLog(`${context.logUri}`);
  appendLog(`${context.logPath}`);
  appendLog(`${context.globalStorageUri}`);
  vscode.window.showInformationMessage('what color');
};
