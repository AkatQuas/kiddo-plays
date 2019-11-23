import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';

@Component({
    selector: 'app-page-404',
    templateUrl: './page-404.html',
    styles: [`
        .error {
            margin: 100px auto 0;
            width: 90%;
            max-width: 500px;
        }

        .error img {
            width: 100%;
        }

        .error p {
            text-align: center;
        }
        .error p span {
            cursor: pointer;
            color: deepskyblue;
        }
        .error p span:hover {
            text-decoration: underline;
        }
    `]
})
export class Page404Component implements OnInit {

    constructor (
        private _location: Location) {
    }

    ngOnInit () {
    }

    backToPrevious(): void {
        this._location.back();
    }

}
