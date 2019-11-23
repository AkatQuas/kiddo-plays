import { Injectable } from '@angular/core';
import { timer } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BeansShooterService {

  constructor() { }

  fire() {
    return timer(1000, 3000)
  }
}
