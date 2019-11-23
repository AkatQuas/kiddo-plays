import { Component } from '@angular/core';
import { BeansShooterService } from './beans-shooter.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less'],
  providers: [BeansShooterService]
})
export class AppComponent {
  title = 'custom-modal';
  fire: Observable<any>;
  constructor(
    private beans: BeansShooterService,
  ) {
    this.fire = this.beans.fire();
  }
}
