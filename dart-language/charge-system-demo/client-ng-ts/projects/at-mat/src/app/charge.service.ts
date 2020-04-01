import { Injectable } from '@angular/core';
import { of, Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material';
import { map, catchError } from 'rxjs/operators';

const httpOptions = {
  headers: new HttpHeaders({ 'content-type': 'application/json' })
};

export interface Choice {
  id: number;
  value: number
}
export interface History {
  time: string,
  value: number
}

@Injectable({
  providedIn: 'root'
})
export class ChargeService {
  private chargeUrl = '/api/charge';
  private historyUrl = '/api/history';
  private choicesUrl = '/api/choices';

  constructor(private http: HttpClient, private snackBar: MatSnackBar) { }
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      this.snackBar.open(`${operation} failed: ${error.error.message}`, '', {
        duration: 1500
      });
      return of(result);
    }
  }

  getChoices(): Observable<Choice[]> {
    return this.http.get<Choice[]>(this.choicesUrl).pipe(
      map(res => res['data']),
      catchError(this.handleError('get choices', []))
    );
  }
  postCharge(value: number): Observable<any> {
    const body = JSON.stringify({ value });
    return this.http.post(this.chargeUrl, body, httpOptions).pipe(
      map(res => res['data']),
      catchError(this.handleError('charge'))
    );
  }
  getHistory(): Observable<History[]> {
    return this.http.get(this.historyUrl).pipe(
      map(res => res['data']),
      catchError(this.handleError('get history', []))
    )
  }
}
