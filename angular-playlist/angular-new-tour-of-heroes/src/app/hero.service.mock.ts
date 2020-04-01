// using mock-data
// mock-heroes.ts
import { Injectable } from '@angular/core';
import { Observable, of } from "rxjs";
import { Hero } from "./hero";
import { HEROES } from "./mock-heroes";
import { MessageService } from "./message.service";

@Injectable({
  providedIn: 'root'
})
export class HeroService {

  constructor(private messageService: MessageService) { }
  getHeroes(): Observable<Hero[]> {
    this.messageService.add('HeroService: fetched heroes')
    return of(HEROES);
  }
  getHero(id: number): Observable<Hero> {
    this.messageService.add(`HeorService: fetched hero id=${id}`)
    const x = HEROES.find(item => item.id === id);
    return of(x);
  }
}
