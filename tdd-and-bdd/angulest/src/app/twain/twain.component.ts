import { Component, OnInit } from '@angular/core';
import { Observable, of } from 'rxjs';
import { TwainService } from './twain.service';
import { startWith, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-twain',
  template: `
    <p class="twain">{{quote | async }}</p>
    <button (click)="getQuote()">Next quote</button>
    <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>
  `,
  styles: []
})
export class TwainComponent implements OnInit {
  errorMessage: string;
  quote: Observable<string>;

  constructor(
    private twainService: TwainService
  ) { }

  ngOnInit( ) {
    this.getQuote();
  }

  getQuote(): void {
    this.errorMessage = '';
    this.quote = this.twainService.getQuote().pipe(
      startWith('...'),
      catchError((err: any) => {
        setTimeout(() => this.errorMessage = err.message || err.toString(), 100);
        return of('...');
      }),
    );
  }

}
