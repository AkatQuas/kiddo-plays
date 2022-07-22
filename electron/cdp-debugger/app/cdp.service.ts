import fetch from 'node-fetch';
import { inject, singleton } from 'tsyringe';
import { PortService } from './port.service';

@singleton()
export class CDPService {
  constructor(@inject(PortService) private readonly portSrv: PortService) {}

  async fetchList() {
    const r = await Promise.all(
      this.portSrv.list().map((port) => this._fetchList(port))
    );
    return r.flat();
  }

  private async _fetchList(port: string): Promise<CDPJSON[]> {
    try {
      const r = await fetch(`http://localhost:${port}/json`, {
        headers: {
          accept: 'application/json, text/plain, */*',
        },
        method: 'GET',
      });
      return await r.json();
    } catch (_e) {
      return [];
    }
  }
}
