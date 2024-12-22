import { JsonRpcClient } from "./json-rpc-client";

export const initVSCode = <T>() => {
  const rpcClient = new JsonRpcClient<T>();

  const vsCodeProxy = rpcClient.createVSCodeProxy();
  return {
    rpcClient,
    vscode: vsCodeProxy,
    vscodeInWebview: rpcClient.vscodeInWebview,
  };
};
