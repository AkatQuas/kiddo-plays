import { Injectable, Optional } from '@angular/core';

let nextId = 1;

export class UserServiceConfig {
    userName = 'Philip Love';
}

@Injectable()
export class UserService {
    id = nextId++;

    constructor ( @Optional() config: UserServiceConfig ) {
        if ( config ) {
            this._userName = config.userName;
        }
    }

    private _userName = 'Sherlock Holmes';

    get userName () {
        const suffix = this.id > 1 ? ` times ${this.id}` : '';
        return this._userName + suffix;
    }

}
