import * as vscode from 'vscode';

export async function askTS(context: vscode.ExtensionContext) {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    console.error('Error: no folder');
    return;
  }
  const pageJSUri = folder.uri.with({
    path: folder.uri.path.concat('/funny/pages/index/index.js'),
  });
  {
    const result = await vscode.commands.executeCommand(
      'vscode.executeDocumentSymbolProvider',
      pageJSUri
    );
    console.log(
      `%c***** symbols *****`,
      'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
      '\n',
      { result },
      '\n'
    );
  }
  {
    const result = await vscode.commands.executeCommand(
      'vscode.executeHoverProvider',
      pageJSUri,
      new vscode.Position(10, 3)
    );
    console.log(
      `%c***** definition *****`,
      'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
      '\n',
      { result },
      '\n'
    );
  }
}
