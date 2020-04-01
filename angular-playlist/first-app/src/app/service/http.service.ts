import {Injectable} from '@angular/core';
import {Headers, Http, Response} from "@angular/http";
import 'rxjs/Rx';
import {Observable} from "rxjs/observable";

@Injectable()
export class HttpService {

    constructor(private http: Http) {
    }

    getData() {
        const url = 'url';
        // extract useful data here rather than in every callback
        return this.http.get(url).map((response: Response) => response.json());
    }

    sendData(user: any) {
        const url = 'url';
        const body = JSON.stringify(user)
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        return this.http.post(url, body, {
            headers: headers
        }).map((data: Response) => data.json()).catch(this.handleError);
    }

    getOwnData() {
        const url = 'url';
        // extract useful data here rather than in every callback
        return this.http.get(url).map((response: Response) => response.json());
    }

    private handleError(error: any) {
        console.log('handle', error);
        return Observable.throw(error.json())
    }

}
