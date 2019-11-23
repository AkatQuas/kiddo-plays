import {Injectable} from '@angular/core';
import {Hero} from './hero';
import {Http} from '@angular/http';

import 'rxjs/add/operator/toPromise';

@Injectable()
export class HeroService {
    private heroesUrl = 'api/heroes';

    constructor(private http: Http) {
    }

    getHeroes(): Promise<Hero[]> {
        return this.http.get(this.heroesUrl).toPromise().then(res => res.json().data as Hero[]).catch(this.handleError);
    };

    getHero(id: number): Promise<Hero> {
        return this.getHeroes().then(heroes => heroes.find(hero => hero.id === id));
    }

    private handleError(err: any): Promise<any> {
        console.error('An error', err)
        return Promise.reject(err.message || err);
    }
}
