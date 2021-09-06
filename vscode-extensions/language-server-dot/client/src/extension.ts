import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
  const debugOptions = { execArgv: ['--nolazy', '--debug=6009'] };
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'dot' }],
    synchronize: {
      // Synchronize the section 'dotLanguageServer' of the settings to the server
      configurationSection: 'dotLanguageServer',
    },
  };
  const client = new LanguageClient(
    'dotLanguageService',
    'LanguageServer',
    serverOptions,
    clientOptions
  );
  const disposable = client.start();
  context.subscriptions.push(disposable);
}
