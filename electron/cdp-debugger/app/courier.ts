import { ipcMain, shell } from 'electron';
import { inject, singleton } from 'tsyringe';
import { CDPService } from './cdp.service';
import { PortService } from './port.service';
import { WindowManager } from './window-manager';

@singleton()
export class Courier {
  constructor(
    @inject(CDPService) private readonly cdp: CDPService,
    @inject(PortService) private readonly portSrv: PortService,
    @inject(WindowManager) private readonly wm: WindowManager
  ) {}
  listen() {
    ipcMain.handle('CDP:list', (_) => this.cdp.fetchList());

    ipcMain.handle('PORT:update', (_, ports: string[]) => {
      this.portSrv.update(ports);
    });

    ipcMain.handle('PORT:list', (_) => this.portSrv.list());

    ipcMain.handle('CDP:debug', (_, page: CDPJSON) =>
      this.wm.openPageDevtools(page)
    );

    ipcMain.on('SHELL:open', (_, url: string) => shell.openExternal(url));
  }

  schedule() {}
}
