import { Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs/observable';
import { of } from 'rxjs/observable/of';
import { delay } from 'rxjs/operators';

export class Crisis {
    constructor ( public id: number, public name: string ) {
    }
}

const CRISIES: Crisis[] = [
    new Crisis(1, 'Dragon Burning Cities'),
    new Crisis(2, 'Sky Rains Great White Sharks'),
    new Crisis(3, 'Giant Asteroid Heading For Earth'),
    new Crisis(4, 'Procrastinators Meeting Delayed Again')
];

const FETCH_LATENCY = 500;

@Injectable()
export class CrisisService implements OnDestroy {
    constructor () {
        console.log('CrisiService instance created.');
    }

    ngOnDestroy () {
        console.log('CrisiService instance destroyed.');
    }

    getCrises (): Observable<Crisis[]> {
        return of(CRISIES).pipe(delay(FETCH_LATENCY));
    }

    getCrisis ( id: number | string ): Observable<Crisis> {
        return of(CRISIES.find(crisis => crisis.id === +id)).pipe(delay(FETCH_LATENCY));
    }
}
