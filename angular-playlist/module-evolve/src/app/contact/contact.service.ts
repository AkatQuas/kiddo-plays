import { Injectable, OnDestroy } from '@angular/core';

import { Observable } from 'rxjs/observable';
import { of } from 'rxjs/observable/of';
import { delay } from 'rxjs/operators';

export class Contact {
    constructor ( public id: number, public name: string ) {
    }
}

const CONTACTS: Contact[] = [
    new Contact(21, 'Sam Spade'),
    new Contact(22, 'Nick Danger'),
    new Contact(23, 'Nancy Drew')
];

const FETCH_LATENCY = 500;

@Injectable()
export class ContactService implements OnDestroy {
    getContacts (): Observable<Contact[]> {
        return of(CONTACTS).pipe(delay(FETCH_LATENCY));
    }

    getContact ( id: number | string ): Observable<Contact> {
        return of(CONTACTS.find(contact => contact.id === +id)).pipe(delay(FETCH_LATENCY));
    }

    ngOnDestroy () {

    }
}
