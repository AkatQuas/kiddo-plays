import * as EventEmitter from 'events';
import { singleton } from 'tsyringe';

const DEFAULT_PORT = '9222';

@singleton()
export class PortService extends EventEmitter {
  constructor() {
    super();
  }
  private _webPort: string[] = [DEFAULT_PORT];

  list(): string[] {
    return this._webPort;
  }

  update(ports: string[]): void {
    if (ports.includes(DEFAULT_PORT)) {
      // pass
    } else {
      ports.unshift(DEFAULT_PORT);
    }
    this._webPort = ports;
  }
}
