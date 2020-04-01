import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FakeValueService {

  constructor() { }

  getValue(): string {
    return 'faked service value';
  }
}
