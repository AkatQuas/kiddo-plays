import "reflect-metadata";
import { container } from "tsyringe";
import * as vscode from "vscode";
import { EXT_NAME } from "./constant";
import { GC } from "./gc";
import { WebviewProvider } from "./webview-base";

export function activate(context: vscode.ExtensionContext) {
  const sidebar = new WebviewProvider(
    EXT_NAME + ".sidebar",
    context.extensionUri,
    "WebviewView Sidebar",
    "sidebar.js"
  );
  sidebar.registerRpcMethod("customLogger", (arg: string, arg2: number) => {
    console.debug("\x1B[97;42;1m --- custom Logger works --- \x1B[m", "\n", {
      arg,
      arg2,
    });
    return { ok: true };
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(sidebar.viewId, sidebar)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(EXT_NAME + ".addColor", () => {
      sidebar.sendMessage("addColor");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(EXT_NAME + ".clearColors", () => {
      sidebar.sendMessage("clearColors");
    })
  );

  const panel = new WebviewProvider(
    EXT_NAME + ".panel",
    context.extensionUri,
    "WebviewView Panel",
    "panel.js"
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(panel.viewId, panel)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(EXT_NAME + ".addNumber", () => {
      panel.sendMessage("addNumber");
      panel.sendMessageToView(EXT_NAME + ".sidebar", "addColor");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(EXT_NAME + ".clearNumber", () => {
      panel.sendMessage("clearNumber");
    })
  );
}

// https://code.visualstudio.com/api/references/activation-events#Start-up
export async function deactivate() {
  GC.dispose();
  await container.dispose();
}
