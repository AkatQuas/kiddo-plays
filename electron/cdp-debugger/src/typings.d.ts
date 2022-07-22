/* SystemJS module definition */
declare const nodeModule: NodeModule;
interface NodeModule {
  id: string;
}
interface Window {
  process: any;
  require: any;
}
interface CDPJSON {
  description: string;
  devtoolsFrontendUrl: string;
  devtoolsFrontendUrlCompat?: string;
  id: string;
  title: string;
  type: 'page' | 'iframe' | 'webview' | 'service_worker' | 'node';
  url: string;
  webSocketDebuggerUrl: string;
}
