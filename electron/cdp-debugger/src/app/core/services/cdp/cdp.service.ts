import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ElectronService } from '../electron/electron.service';

@Injectable({
  providedIn: 'root',
})
export class CDPService {
  private _list$ = new BehaviorSubject<CDPJSON[]>([]);
  constructor(private electron: ElectronService) {
    // AT "2022/07/21 11:23"
    // TODO
    // Release interval
    setInterval(() => {
      this._fetchList();
    }, 10000);
    this._fetchList();
  }

  private _fetchList() {
    this.electron.ipcRenderer
      .invoke('CDP:list')
      .then((r) => this._list$.next(r));
  }

  refresh() {
    this._fetchList();
  }

  getList() {
    return this._list$.asObservable();
  }

  openDevtools(page: CDPJSON) {
    this.electron.ipcRenderer.invoke('CDP:debug', page);
  }

  updatePorts(ports: string[]) {
    this.electron.ipcRenderer.invoke('PORT:update', ports).then(() => {
      this._fetchList();
    });
  }
  listPort(): Promise<string[]> {
    return this.electron.ipcRenderer.invoke('PORT:list');
  }
}
