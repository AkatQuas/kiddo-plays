import * as vscode from 'vscode';
import { ProcEditorProvider } from './proc-editor';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(ProcEditorProvider.register(context));
}
