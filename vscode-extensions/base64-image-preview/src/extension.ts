import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      [
        'css',
        'less',
        'scss',
        'html',
        'json',
        'jsonc',
        'javascript',
        'typescript',
        'javascriptreact',
        'typescriptreact',
      ],
      {
        provideHover: (document, position, token) => {
          const regexp =
            /('|")(data:image\/(?:jpeg|png|gif);base64,[a-zA-Z0-9+/=]+)\1/;
          // const range = document.getWordRangeAtPosition(position, regexp);
          // `getWordRangeAtPosition` doesn't work well because the base64 string is separated by word delimiters.
          const range = new vscode.Range(
            new vscode.Position(position.line, 0),
            new vscode.Position(position.line + 1, 0)
          );
          const text = document.getText(range);
          const match = regexp.exec(text);
          if (!match) {
            return null;
          }
          return new vscode.Hover(
            new vscode.MarkdownString(
              `Base64 Image Preview\n\n![image](${match[2]})`
            )
          );
        },
      }
    )
  );
}

export function deactivate() {}
