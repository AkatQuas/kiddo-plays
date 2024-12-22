# Webview View API Sample

Enhanced VS Code's [webview view API](https://github.com/microsoft/vscode/issues/46585). This includes:

- Contributing a webview based view to the explorer.
- Posting messages from the extension to a webview view
- Posting messages from a webview to the extension
  - Requesting an RPC request to get the response
- Posting messages from a webview view to another webview view
- Persisting state in the view.
- Contributing commands to the view title.

## VS Code API

### `vscode` module

- [`window.registerWebviewViewProvider`](https://code.visualstudio.com/api/references/vscode-api#window.registerWebviewViewProvider)

## Running the example

- Open this example in VS Code 1.49+
- `npm install`
- `npm run watch` or `npm run compile`
- `F5` to start debugging

In the sidebar, expand the `Webview Sample` view.

## Pack up

`Meta + Shift + P` -> `Tasks: Run Task` -> select `[TEST] Pack extension` to pack the extension locally.
