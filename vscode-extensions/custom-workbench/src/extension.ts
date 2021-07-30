// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Dependency, NodeDependenciesProvider } from './nodeDependencies';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "custom-workbench" is now active!'
  );
  const nodeDependenciesProvider = new NodeDependenciesProvider(
    vscode.workspace.rootPath
  );

  debugger;
  vscode.window.registerTreeDataProvider(
    'nodeDependencies',
    nodeDependenciesProvider
  );
  {
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand(
      'custom-workbench.helloWorld',
      () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage(
          'Hello World from custom-workbench!'
        );
      }
    );

    context.subscriptions.push(disposable);
  }
  {
    let disposable = vscode.commands.registerCommand(
      'nodeDependencies.refreshEntry',
      () => {
        nodeDependenciesProvider.refresh();
      }
    );

    context.subscriptions.push(disposable);
  }
  {
    let disposable = vscode.commands.registerCommand(
      'nodeDependencies.addEntry',
      (...args) => {
        console.log(`add args ->`, args);
        nodeDependenciesProvider.addEntry();
      }
    );

    context.subscriptions.push(disposable);
  }
  {
    let disposable = vscode.commands.registerCommand(
      'nodeDependencies.editEntry',
      (node: Dependency) => {
        console.log(`edit node ->`, node);
        nodeDependenciesProvider.editEntry(node);
      }
    );

    context.subscriptions.push(disposable);
  }
  {
    let disposable = vscode.commands.registerCommand(
      'nodeDependencies.deleteEntry',
      (node: Dependency) => {
        console.log(`delete node ->`, node);
        nodeDependenciesProvider.deleteEntry(node);
      }
    );

    context.subscriptions.push(disposable);
  }
}

// this method is called when your extension is deactivated
export function deactivate() {}
