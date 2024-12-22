import * as vscode from "vscode";
import { WebviewApi } from "vscode-webview";

interface ResponseError {
  code: number;
  message: string;
  data?: any;
}

interface CustomRequest {
  event: string;
  data?: any;
}

export type CustomMessageEvent = MessageEvent<CustomRequest>;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: any;
  id: number;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: ResponseError;
  id: number;
}

export class JsonRpcClient<T> {
  private _nextId: number = 4000;
  private _pendingRequests: Map<number, (response: JsonRpcResponse) => void> =
    new Map();

  private _vscodeInWebview: WebviewApi<T>;

  public get vscodeInWebview() {
    return this._vscodeInWebview;
  }

  constructor() {
    this._vscodeInWebview = window.acquireVsCodeApi<T>();
    window.addEventListener("message", this.handleMessage.bind(this));
  }

  /**
   * call rpc method, both vscode and custom method are supported
   */
  public async call<T>(method: string, params?: any[]): Promise<T> {
    const id = this._nextId++;
    const request: JsonRpcRequest = { jsonrpc: "2.0", method, params, id };

    return new Promise((resolve, reject) => {
      this._pendingRequests.set(id, (response: JsonRpcResponse) => {
        if (response.error) {
          const error = new Error(response.error.message);
          (error as any).code = response.error.code;
          (error as any).data = response.error.data;
          reject(error);
        } else {
          resolve(response.result);
        }
      });

      this._vscodeInWebview.postMessage(request);
    });
  }

  private handleMessage(event: MessageEvent<JsonRpcResponse>) {
    const response = event.data;
    if (response.jsonrpc === "2.0" && this._pendingRequests.has(response.id)) {
      const handler = this._pendingRequests.get(response.id);
      if (handler) {
        handler(response);
        this._pendingRequests.delete(response.id);
      }
    }
  }

  public createVSCodeProxy(): typeof vscode {
    const handler = {
      get: (target: any, prop: string) => {
        if (typeof prop === "string") {
          return new Proxy(() => {}, {
            get: (_, nestedProp: string) => {
              return this.createNestedProxy(`${prop}.${nestedProp}`);
            },
            apply: (_, __, args: any[]) => this.call(`vscode.${prop}`, args),
          });
        }
      },
    };

    return new Proxy({}, handler);
  }

  private createNestedProxy(path: string): any {
    return new Proxy(() => {}, {
      get: (_, prop: string) => {
        return this.createNestedProxy(`${path}.${prop}`);
      },
      apply: (_, __, args: any[]) => this.call(`vscode.${path}`, args),
    });
  }
}
