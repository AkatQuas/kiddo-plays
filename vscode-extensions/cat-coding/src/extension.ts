import * as path from 'path';
import * as vscode from 'vscode';

const cats = {
  'Coding Cat': 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
  'Compiling Cat': 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif',
  'Testing Cat': 'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif',
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "cat-coding" is now active!');

  let currentPanel: vscode.WebviewPanel | undefined = undefined;

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  context.subscriptions.push(
    vscode.commands.registerCommand('cat-coding.start', () => {
      const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.ViewColumn.Active
        : vscode.ViewColumn.One;
      if (currentPanel) {
        currentPanel.reveal(columnToShowIn);
      } else {
        // Create and show a new webview
        currentPanel = vscode.window.createWebviewPanel(
          'catCoding' /* Identifies the type of the webview. Used internally */,
          'Cat Coding' /* Title of the panel displayed to the user */,
          columnToShowIn /* Editor column to show the new webview panel in */,
          {
            enableScripts: true,
            enableFindWidget: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
              vscode.Uri.file(path.join(context.extensionPath, 'media')),
            ],
          } /* Webview options. */
        );
        updateWebviewForCat(currentPanel);
        const timeout = setInterval(async () => {
          const onDiskPath = vscode.Uri.file(
            path.join(context.extensionPath, 'media', 'cat.gif')
          );
          await vscode.window.showWarningMessage(onDiskPath.toString());
          // prompt to close
          const result = await vscode.window.showInformationMessage(
            'Close Cat Coding Panel?',
            { modal: true },
            'Yes',
            'No'
          );
          if (result === 'Yes') {
            currentPanel!.dispose();
          } else {
            vscode.window.showWarningMessage("I'll ask you later!");
          }
        }, 6000);
        currentPanel!.onDidDispose(
          () => {
            clearInterval(timeout);
            currentPanel = undefined;
            // When the panel is closed, cancel any future updates to the webview content
            // panel is closed before dispose function
          },
          null,
          context.subscriptions
        );
        currentPanel.onDidChangeViewState(
          (e) => {
            const panel = e.webviewPanel;
            updateWebviewForCat(panel);
          },
          null,
          context.subscriptions
        );
        currentPanel.webview.onDidReceiveMessage(
          (message) => {
            switch (message.command) {
              case 'alert':
                vscode.window.showErrorMessage(message.text);
                break;

              default:
                break;
            }
          },
          undefined,
          context.subscriptions
        );
      }
    })
  );

  // new command
  context.subscriptions.push(
    vscode.commands.registerCommand('cat-coding.doRefactor', () => {
      if (!currentPanel) {
        return;
      }

      // Send a message to the webview
      currentPanel.webview.postMessage({ command: 'refactor' });
    })
  );

  vscode.window.registerWebviewPanelSerializer(
    'catCoding',
    new CatCodingSerializer()
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

function updateWebviewForCat(panel: vscode.WebviewPanel) {
  let catName: keyof typeof cats = 'Testing Cat';
  switch (panel.viewColumn) {
    case vscode.ViewColumn.One:
      catName = 'Coding Cat';
      break;
    case vscode.ViewColumn.Two:
      catName = 'Compiling Cat';
      break;
    default:
      break;
  }
  console.log('update with ', catName);

  panel.title = catName;
  panel.webview.html = getWebviewContent(catName);
}

function getWebviewContent(cat: keyof typeof cats): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cat Coding</title>
</head>
<body>
  <img src="${cats[cat]}" width="300" />
  <h1 id="lines-of-code-counter">0</h1>
  <script>
  console.log(123);
  const counter = document.getElementById('lines-of-code-counter');
  const vscode = acquireVsCodeApi();

  const previousState = vscode.getState();
  let count = previousState ? previousState.count : 0;
  counter.textContent = count;

  setInterval(() => {
    counter.textContent = count++;
    vscode.setState({ count, cat: '${cat}' });

    // Alert the extension when our cat introduces a bug
    if (Math.random() < 0.001 * count) {
      vscode.postMessage({
        command: 'alert',
        text: '🐛  on line ' + count
      })
    }
  }, 100);

  // Handle the message inside the webview
  window.addEventListener('message', event => {
    const message = event.data;
    console.log(message)
    switch (message.command) {
      case 'refactor':
        count = Math.ceil(count * 0.5);
        counter.textContent = count;
        break;
    }
  });
  </script>
</body>
</html>`;
}

class CatCodingSerializer implements vscode.WebviewPanelSerializer {
  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
    // `state` is the state persisted using `setState` inside the webview
    console.log(`Got state: `, state);

    // Restore the content of our webview.
    //
    // Make sure we hold on to the `webviewPanel` passed in here and
    // also restore any event listeners we need on it.
    webviewPanel.webview.html = getWebviewContent(state?.cat ?? 'Testing Cat');
    /**
     * MAYBE TTMAY
     * this webviewPanel lost some event listener
     */
  }
}
