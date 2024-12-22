import { container, singleton } from "tsyringe";
import * as vscode from "vscode";
import { getLogger } from "./logger";
import type { WebviewProvider } from "./webview-base";

export interface ResponseError {
  code: number;
  message: string;
  data?: any;
}

export interface CustomRequest {
  event: string;
  data?: any;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id: number;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: ResponseError;
  id: number;
}

/**
 * The JSONRpcCenter class is responsible for handling JSON-RPC requests and responses
 * within a VS Code webview environment. It implements the vscode.Disposable interface
 * to ensure proper cleanup of resources.
 */
@singleton()
export class JSONRpcCenter implements vscode.Disposable {
  /**
   * A map that stores registered RPC methods and their corresponding handlers.
   */
  private _rpcHandler: Map<string, CallableFunction> = new Map();

  /**
   * A map that stores webview providers by their view IDs.
   */
  private _viewMap: Map<string, WebviewProvider> = new Map();

  /**
   * Disposes of the JSONRpcCenter instance by clearing the RPC handler and view maps.
   */
  public dispose() {
    this._rpcHandler.clear();
    this._viewMap.forEach((view) => view.dispose());
    this._viewMap.clear();
  }

  /**
   * Adds a webview provider to the view map.
   *
   * @param viewProvider - The webview provider to add.
   */
  public addView(viewProvider: WebviewProvider) {
    this._viewMap.set(viewProvider.viewId, viewProvider);
  }

  /**
   * Registers an RPC method with a corresponding handler.
   *
   * @param method - The name of the RPC method to register.
   * @param handler - The function to handle the RPC method.
   * @throws {Error} If the method is already registered.
   */
  public registerRpcMethod(method: string, handler: CallableFunction) {
    if (this._rpcHandler.has(method)) {
      throw new Error(`Method "${method}" already exists`);
    }
    this._rpcHandler.set(method, handler);
  }

  sendMessageToView(viewId: string, event: string, data: any) {
    const view = this._viewMap.get(viewId);
    if (view) {
      view.sendMessage(event, data);
    }
  }

  /**
   * Handles incoming JSON-RPC messages from the webview.
   *
   * @param webviewView - The webview view from which the message originated.
   * @param message - The JSON-RPC request message.
   */
  async handleMessage(
    webviewView: vscode.WebviewView,
    message: JsonRpcRequest
  ) {
    if (message.jsonrpc !== "2.0") {
      return;
    }
    try {
      const result = await this._callRpcMethod(message.method, message.params);
      this._sendResponse(webviewView, {
        jsonrpc: "2.0",
        result,
        id: message.id,
      });
    } catch (error) {
      this._sendResponse(webviewView, {
        jsonrpc: "2.0",
        error: error as ResponseError,
        id: message.id,
      });
    }
  }

  /**
   * Calls the appropriate RPC method based on the method name.
   *
   * @param method - The name of the RPC method to call.
   * @param params - The parameters to pass to the RPC method.
   * @returns The result of the RPC method call.
   * @throws {Error} If the method is not found or an internal error occurs.
   */
  private async _callRpcMethod(method: string, params?: any): Promise<any> {
    try {
      const rpcMethod = method.startsWith("vscode.")
        ? this._getVSCodeRpcMethod(method)
        : this._getInstanceRpcMethod(method);
      const logger = getLogger();
      logger.info(`Calling ${method} with params:`, params);
      return await rpcMethod(...(params || []));
    } catch (error) {
      if (error instanceof Error) {
        throw {
          code: -403,
          message: "Method not found",
          data: error.message,
        };
      } else {
        throw {
          code: -500,
          message: "Internal error",
          data: String(error),
        };
      }
    }
  }

  /**
   * Retrieves a VS Code RPC method based on the method name.
   *
   * @param method - The name of the VS Code RPC method to retrieve.
   * @returns The VS Code RPC method.
   * @throws {Error} If the method is not found or is not a function.
   */
  private _getVSCodeRpcMethod(method: string): CallableFunction {
    const parts = method.split(".");
    const first = parts[0];
    if (first !== "vscode" || parts.length === 1) {
      throw {
        code: -403,
        message: "Method not found",
        data: `Invalid method: ${method}`,
      };
    }

    let current: any = vscode;

    for (let i = 1; i < parts.length - 1; i++) {
      if (current[parts[i]] === undefined) {
        throw new Error(`Method not found: ${parts.slice(1, i + 1).join(".")}`);
      }
      current = current[parts[i]];
    }

    const func = parts[parts.length - 1];
    if (typeof current[func] !== "function") {
      throw new Error(`${method} is not a function`);
    }
    return current[func];
  }

  /**
   * Retrieves an instance RPC method based on the method name.
   *
   * @param method - The name of the instance RPC method to retrieve.
   * @returns The instance RPC method.
   * @throws {Error} If the method is not found or is not a function.
   */
  private _getInstanceRpcMethod(method: string): CallableFunction {
    const current = this._rpcHandler.get(method);
    if (!current || typeof current !== "function") {
      throw new Error(`${method} is not a function`);
    }
    return current;
  }

  /**
   * Sends a JSON-RPC response message to the webview.
   *
   * @param webviewView - The webview view to send the response to.
   * @param response - The JSON-RPC response message.
   */
  private _sendResponse(
    webviewView: vscode.WebviewView,
    response: JsonRpcResponse
  ) {
    webviewView.webview.postMessage(response);
  }
}

export const getJSONRpcCenter = () => {
  const c = container.resolve(JSONRpcCenter);
  return c;
};
