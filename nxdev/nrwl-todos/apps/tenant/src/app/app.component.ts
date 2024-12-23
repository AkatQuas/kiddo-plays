import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Message } from '@nrwl-todos/api-interfaces';

@Component({
  selector: 'tenant-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less'],
})
export class AppComponent {
  hello$ = this.http.get<Message>('/api/hello');
  constructor(private http: HttpClient) {}
}
