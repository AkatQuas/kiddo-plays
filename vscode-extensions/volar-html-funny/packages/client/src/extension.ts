import * as serverProtocol from '@volar/language-server/protocol';
import { activateAutoInsertion, createLabsInfo, getTsdk } from '@volar/vscode';
import * as vscode from 'vscode';
import * as lsp from 'vscode-languageclient/node';

let client: lsp.BaseLanguageClient;

export const activate = async (context: vscode.ExtensionContext) => {
  const serverModule = vscode.Uri.joinPath(
    context.extensionUri,
    'dist',
    'server.js'
  );

  const runOptions = { execArgv: <string[]>[] };
  const debugOptions = { execArgv: ['--nolazy', '--inspect=' + 6009] };
  const serverOptions: lsp.ServerOptions = {
    run: {
      module: serverModule.fsPath,
      transport: lsp.TransportKind.ipc,
      options: runOptions,
    },
    debug: {
      module: serverModule.fsPath,
      transport: lsp.TransportKind.ipc,
      options: debugOptions,
    },
  };

  const clientOptions: lsp.LanguageClientOptions = {
    documentSelector: [{ language: 'html_funny' }],
    initializationOptions: {
      typescript: {
        tsdk: (await getTsdk(context)).tsdk,
      },
    },
  };

  client = new lsp.LanguageClient(
    'html-funny-server',
    'HTML funny Language Server',
    serverOptions,
    clientOptions
  );

  try {
    await client.start();

  } catch (error) {
    console.debug('\x1B[97;101;1m --- start failed --- \x1B[m', '\n', error);
    return
  }

  // Bonus: Add support for auto insertion of closing tags (ex: <div> -> <div></div>)
  activateAutoInsertion('html_funny', client);

  // Needed code to add support for Volar Labs
  // https://volarjs.dev/core-concepts/volar-labs/

  const labsInfo = createLabsInfo(serverProtocol);
  labsInfo.addLanguageClient(client);

  return labsInfo.extensionExports;
};

export const deactivate = async () => {
  return client?.stop();
};
