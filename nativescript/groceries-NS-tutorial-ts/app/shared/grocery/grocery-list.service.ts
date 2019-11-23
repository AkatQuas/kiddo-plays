import { Injectable } from '@angular/core';
import { Http, Headers, Response } from '@angular/http';
import { Observable } from 'rxjs/Rx';
import 'rxjs/add/operator/map';

import { Config } from '../config';
import { Grocery } from './grocery';

@Injectable()
export class GroceryListService {
    constructor(private http: Http) { }

    load() {
        let headers = new Headers();
        headers.append('Authorization', 'Bearer ' + Config.token);

        return this.http.get(Config.apiUrl + 'Groceries', {
            headers,
        })
            .map(res => res.json())
            .map(data => {
                let groceryList = [];
                data.Result.forEach(g => {
                    groceryList.push(new Grocery(g.Id, g.Name));
                });
                return groceryList;
            })
            .catch(this.handleErrors);
    }
    add(name: string) {
        let headers = new Headers();
        headers.append('Authorization', 'Bearer ' + Config.token);
        headers.append('Content-Type', 'application/json');

        return this.http.post(
            Config.apiUrl + 'Groceries',
            JSON.stringify({ Name: name }),
            { headers }
        )
            .map(res => res.json())
            .map(data => {
                return new Grocery(data.Result.Id, name);
            })
            .catch(this.handleErrors);
    }

    delete(id: string) {
        let headers = new Headers();
        headers.append('Authorization', 'Bearer ' + Config.token);
        headers.append('Content-Type', 'application/json');
        return this.http.delete(
            Config.apiUrl+ 'Groceries/' + id,
            {headers}
        ).map(res => res.json()).catch(this.handleErrors);
    }

    handleErrors(err: Response) {
        console.log(JSON.stringify(err.json()));
        return Observable.throw(err);
    }
}