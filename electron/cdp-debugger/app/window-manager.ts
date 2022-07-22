import { inject, singleton } from 'tsyringe';
import { Environment } from './environment';
import { DashboardWindow } from './wins/dashboard.window';
import { DevtoolsWindow } from './wins/devtools.window';

@singleton()
export class WindowManager {
  private _devWindows: Map<string, DevtoolsWindow> = new Map();
  private readonly _dashboard: DashboardWindow;
  constructor(@inject(Environment) private readonly env: Environment) {
    this._dashboard = new DashboardWindow(env);
  }

  openDashboard(): void {
    this._dashboard.show();
  }

  openPageDevtools(page: CDPJSON): void {
    const { id } = page;
    if (this._devWindows.has(id)) {
      this._devWindows.get(id).show();
      return;
    }
    const webWin = new DevtoolsWindow(this.env, page);
    webWin.show();
    webWin.on('closed', () => {
      this._devWindows.delete(id);
    });
    this._devWindows.set(id, webWin);
  }
}
