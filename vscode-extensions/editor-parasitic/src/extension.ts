import * as vscode from 'vscode';
import { askTS } from './ask-tsserver';
const channel = vscode.window.createOutputChannel('Parasitic-tag');
function appendLog(value: string) {
  channel.appendLine('\n\n---\n');
  channel.appendLine(value);
  channel.appendLine('\n---\n\n');
}

export function activate(context: vscode.ExtensionContext) {
  // vscode.workspace.onDidChangeTextDocument((e) => {
  //   console.log(
  //     `%c***** content change *****`,
  //     'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
  //     '\n',
  //     {
  //       contentChange: e.contentChanges,
  //       reason: e.reason,
  //     },
  //     '\n'
  //   );
  // });

  let disposable = vscode.commands.registerCommand(
    'parasitic.activate',
    () => {}
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
