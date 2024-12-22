import { container, singleton } from "tsyringe";
import { Disposable, window } from "vscode";
import { ExtConfig } from "./config";
import { EXT_NAME } from "./constant";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "NONE";

/**
 * thanks to prettier
 * https://github.com/prettier/prettier-vscode/blob/main/src/LoggingService.ts
 */
@singleton()
export class Logger implements Disposable {
  /** output channel */
  private _c = window.createOutputChannel(EXT_NAME);

  /** log Level */
  private _l: LogLevel = "INFO";

  constructor(private _config: ExtConfig) {
    const c = this._config.getByUri();
    if (c.enableDebugLogs) {
      this.setOutputLevel("DEBUG");
    }
  }

  setOutputLevel(logLevel: LogLevel) {
    this._l = logLevel;
  }

  debug(message: string, data?: unknown): void {
    if (
      this._l === "NONE" ||
      this._l === "INFO" ||
      this._l === "WARN" ||
      this._l === "ERROR"
    ) {
      return;
    }
    this.pMessage(message, "DEBUG");
    if (data) {
      this.pObject(data);
    }
  }

  /**
   * Append messages to the output channel and format it with a title
   *
   * @param message The message to append to the output channel
   */
  info(message: string, data?: unknown): void {
    if (this._l === "NONE" || this._l === "WARN" || this._l === "ERROR") {
      return;
    }
    this.pMessage(message, "INFO");
    if (data) {
      this.pObject(data);
    }
  }

  /**
   * Append messages to the output channel and format it with a title
   *
   * @param message The message to append to the output channel
   */
  warn(message: string, data?: unknown): void {
    if (this._l === "NONE" || this._l === "ERROR") {
      return;
    }
    this.pMessage(message, "WARN");
    if (data) {
      this.pObject(data);
    }
  }

  error(message: string, error?: unknown) {
    if (this._l === "NONE") {
      return;
    }
    this.pMessage(message, "ERROR");
    if (typeof error === "string") {
      // Errors as a string usually only happen with
      // plugins that don't return the expected error.
      this._c.appendLine(error);
    } else if (error instanceof Error) {
      if (error?.message) {
        this.pMessage(error.message, "ERROR");
      }
      if (error?.stack) {
        this._c.appendLine(error.stack);
      }
    } else if (error) {
      this.pObject(error);
    }
  }

  /** Reveal output channel in the UI. */
  show() {
    this._c.show();
  }

  /** Dispose and free associated resources. */
  dispose() {
    this._c.dispose();
  }

  private pObject(data: unknown): void {
    const message = JSON.stringify(data, null, 2);

    this._c.appendLine(message);
  }

  /**
   * Append messages to the output channel and format it with a title
   *
   * @param message The message to append to the output channel
   */
  private pMessage(message: string, logLevel: LogLevel): void {
    const title = new Date().toLocaleTimeString();
    this._c.appendLine(`["${logLevel}" - ${title}] ${message}`);
  }
}
export const getLogger = () => {
  const l = container.resolve(Logger);
  return l;
};
