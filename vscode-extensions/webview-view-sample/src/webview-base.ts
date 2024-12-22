import * as vscode from "vscode";
import type {
  CustomRequest,
  JSONRpcCenter,
  JsonRpcRequest,
} from "./json-rpc-center";
import { getJSONRpcCenter } from "./json-rpc-center";

export class WebviewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  view?: vscode.WebviewView;
  private readonly _rpcCenter: JSONRpcCenter;

  constructor(
    public readonly viewId: string,
    private readonly _extensionUri: vscode.Uri,
    private readonly _title: string,
    private readonly _scriptName: string
  ) {
    this._rpcCenter = getJSONRpcCenter();
    this._rpcCenter.addView(this);
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,

      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: JsonRpcRequest) => {
      return this._rpcCenter.handleMessage(webviewView, message);
    });
  }
  /**
   * register custom rpc method, return any data if necessary
   */
  public registerRpcMethod(method: string, handler: CallableFunction) {
    this._rpcCenter.registerRpcMethod(method, handler);
  }

  public dispose() {
    this.view = undefined;
  }

  /**
   * send {@link CustomRequest} to webview, ignore the response
   */
  public async sendMessage(
    event: CustomRequest["event"],
    data?: CustomRequest["data"]
  ) {
    if (!this.view) {
      return;
    }
    this.view.show(true);
    const request: CustomRequest = {
      event,
      data,
    };
    this.view.webview.postMessage(request);
  }

  public async sendMessageToView(
    viewId: string,
    event: CustomRequest["event"],
    data?: CustomRequest["data"]
  ) {
    // funny but it works
    if (viewId === this.viewId) {
      return this.sendMessage(event, data);
    }
    this._rpcCenter.sendMessageToView(viewId, event, data);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "webview",
        "dist",
        this._scriptName
      )
    );

    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "webview", "static", "reset.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "webview", "static", "vscode.css")
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "webview", "static", "main.css")
    );

    const nonce = this._getNonce();

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">

				<title>${this._title}</title>
			</head>
			<body>
				<div id="root"></div>

				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
  }

  private _getNonce() {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
