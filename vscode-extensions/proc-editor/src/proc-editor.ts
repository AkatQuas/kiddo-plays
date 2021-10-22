import * as vscode from 'vscode';
import { Procfile } from './proc-core/procfile';
import { getNonce } from './util';

export class ProcEditorProvider implements vscode.CustomTextEditorProvider {
  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new ProcEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      ProcEditorProvider.viewType,
      provider
    );
  }
  private static readonly viewType = 'procCustoms.procfile';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    webviewPanel.webview.html = this.getHTMLforWebview(webviewPanel.webview);

    function updateWebview() {
      webviewPanel.webview.postMessage({
        type: 'update',
        text: document.getText(),
      });
    }

    // Hook up event handlers so that we can synchronize the webview with the text document.
    //
    // The text document acts as our model, so we have to sync change in the document to our
    // editor and sync changes in the editor back to the document.
    const changeDocumentsSubscription =
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      });

    // Dispose listener when editor is closed.
    webviewPanel.onDidDispose(() => {
      changeDocumentsSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage((e) => {
      switch (e.type) {
        case 'append':
          this.askForNewLine().then(
            (text) => {
              if (text.trim().length > 0) {
                this.addNewLine(document, text);
              }
            },
            () => {
              vscode.window.showInformationMessage(
                `Failed to append new line`,
                { modal: true }
              );
            }
          );
          return;
        case 'insert':
          this.askForNewLine().then(
            (text) => {
              if (text.trim().length > 0) {
                this.insertLine(document, e.predicate, text);
              }
            },
            () => {
              vscode.window.showInformationMessage(
                `Failed to insert a new line`,
                { modal: true }
              );
            }
          );
          return;
        case 'update':
          this.askForUpdate(e.text).then(
            (newText) => {
              this.updateLine(document, e.predicate, newText);
            },
            () => {
              vscode.window.showInformationMessage(`Failed to update line`, {
                modal: true,
              });
            }
          );
          return;

        case 'remove':
          this.confirmRemove().then(
            (yes) => {
              if (yes) {
                this.removeLine(document, e.predicate);
              }
            },
            () => {
              vscode.window.showInformationMessage(`Failed to remove line`, {
                modal: true,
              });
            }
          );
          return;
        default:
          vscode.window.showInformationMessage(
            `Unhandled message type: "${e.type}"`
          );

          return;
      }
    });

    updateWebview();
  }

  /**
   * Get the initial html string for webview when the editor is active
   * @returns
   */
  private getHTMLforWebview(webview: vscode.Webview): string {
    // Local path to script and css for the webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resource', 'procfile.js')
    );

    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resource', 'reset.css')
    );

    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resource', 'vscode.css')
    );
    const styleProcfileUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resource', 'procfile.css')
    );
    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
				-->
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" >
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="${styleResetUri}" rel="stylesheet" />
      <link href="${styleVSCodeUri}" rel="stylesheet" />
      <link href="${styleProcfileUri}" rel="stylesheet" />

      <title>Procfile Document</title>
    </head>
    <body>
      <div class="lines"></div>
      <div class="append-button"><button>Add Line!</button></div>
      <div class="error"></div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }
  private async askForNewLine(): Promise<string> {
    const result = await vscode.window.showInputBox({
      title: 'New process command or comment',
      placeHolder: 'hello: echo "hello 42!"',
    });
    return result ?? '';
  }

  /**
   * Add a new line to the current document, processDef or comment
   */
  private addNewLine(document: vscode.TextDocument, text: string) {
    const procfile = this.getDocumentAsProcfile(document);
    procfile.appendLine(text);
    return this.updateTextDocument(document, procfile.toString());
  }

  /**
   * Insert a new line to the current document at index predicate, processDef or comment
   */
  private insertLine(
    document: vscode.TextDocument,
    predicate: number,
    text: string
  ) {
    const procfile = this.getDocumentAsProcfile(document);
    procfile.insertLine(predicate, text);
    return this.updateTextDocument(document, procfile.toString());
  }

  private async askForUpdate(text: string): Promise<string> {
    const result = await vscode.window.showInputBox({
      title: 'Update process command or comment',
      placeHolder: 'hello: echo "hello 42!"',
      value: text,
    });
    console.log('updated', result);

    return result ?? '';
  }

  /**
   * update line to the current document at line, processDef or comment
   */
  private updateLine(
    document: vscode.TextDocument,
    predicate: number | string,
    text: string
  ) {
    const procfile = this.getDocumentAsProcfile(document);
    procfile.updateLine(predicate, text);
    return this.updateTextDocument(document, procfile.toString());
  }

  private async confirmRemove(): Promise<boolean> {
    const result = await vscode.window.showInformationMessage(
      `Do you want to remove this line?`,
      {
        modal: true,
      },
      'OK'
    );
    return result === 'OK';
  }

  /**
   * Delete an existing line
   */
  private removeLine(
    document: vscode.TextDocument,
    predicate: number | string
  ) {
    const procfile = this.getDocumentAsProcfile(document);
    procfile.removeLine(predicate);
    return this.updateTextDocument(document, procfile.toString());
  }

  private getDocumentAsProcfile(document: vscode.TextDocument): Procfile {
    const text = document.getText();
    if (text.trim().length === 0) {
      return Procfile.fromString('');
    }

    return Procfile.fromString(text);
  }

  /**
   * write result to TextDocument
   * @param document
   * @param content
   * @returns
   */
  private updateTextDocument(document: vscode.TextDocument, content: string) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      content
    );
    return vscode.workspace.applyEdit(edit);
  }
}
