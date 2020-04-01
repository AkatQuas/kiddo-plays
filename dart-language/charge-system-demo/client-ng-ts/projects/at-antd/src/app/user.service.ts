import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { NzMessageService } from 'ng-zorro-antd';

const httpOptions = {
  headers: new HttpHeaders({ 'content-type': 'application/json' })
};

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private loginUrl = 'api/login';
  private currentUser = '';
  private auth = false;

  constructor(private http: HttpClient, private message: NzMessageService) { }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      this.message.create('error', `${operation} failed: ${error.error.message}`);
      return of(result);
    }
  }

  login(username, password): Observable<any> {
    const body = JSON.stringify({ username, password });
    return this.http.post(this.loginUrl, body, httpOptions).pipe(
      tap(() => { this.setUsername(username); this.setAuth(true) }),
      map((res) => res['data']),
      catchError(this.handleError<any>('login'))
    );
  }
  logout() {
    this.setUsername();
    this.setAuth();
  }

  setUsername(name: string = ''): void {
    this.currentUser = name;
  }
  setAuth(auth: boolean = false) {
    this.auth = auth;
  }
  isAuthed(): boolean {
    return this.auth;
  }
  getCurrentUser(): string {
    return this.currentUser;
  }
}
