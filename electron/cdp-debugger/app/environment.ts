import { app } from 'electron';
import { singleton } from 'tsyringe';
import { ensureEndSlash } from './utils';

@singleton()
export class Environment {
  private _serve: boolean;

  public get serve(): boolean {
    return this._serve;
  }

  public get assetsBase(): string {
    return this._serve
      ? 'http://localhost:4200/'
      : ensureEndSlash(`file://${app.getAppPath()}`);
  }

  constructor() {
    this._parse();
  }

  private _parse(): void {
    const args = process.argv.slice(1);
    this._serve = args.some((v) => v === '--serve');
  }
}
