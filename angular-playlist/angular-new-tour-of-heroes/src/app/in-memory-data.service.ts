import { InMemoryDbService } from 'angular-in-memory-web-api';
import { Hero } from './hero';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class InMemoryDataService implements InMemoryDbService {
  createDb() {
    const heroes = [
      { id: 11, name: 'Mr. Nice' },
      { id: 12, name: 'Mr. Neo' },
      { id: 13, name: 'Mr. Sun' },
      { id: 14, name: 'Mr. Yang' },
      { id: 15, name: 'Mr. Zhang' },
      { id: 16, name: 'Mr. Feng' },
      { id: 17, name: 'Mr. Li' },
      { id: 18, name: 'Mr. Wang' },
      { id: 19, name: 'Mr. Zhu' }
    ];
    return { heroes }
  }
  genId(heroes: Hero[]): number {
    return heroes.length > 0 ? Math.max(...heroes.map(hero => hero.id)) + 1 : 11;
  }
  constructor() { }
}
