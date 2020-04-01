import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TwainService {

  constructor() { }
  getQuote(): Observable<string> {
    const s = Math.floor(Math.random() * 10000).toString(32);
    return of(s);
  }
}
