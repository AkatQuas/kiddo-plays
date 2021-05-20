import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class RandomService {
  getRandom(): string {
    return '[Ray RandomService]' + Math.random().toString(32);
  }
}
