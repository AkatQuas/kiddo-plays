import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { APP_CONFIG } from '../environments/environment';
import { ElectronService } from './core/services';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  constructor(
    private electron: ElectronService,
    private translate: TranslateService
  ) {
    this.translate.setDefaultLang('en');
    console.debug(
      '%c***** APP_CONFIG *****',
      'background: #6D6D6D; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
      '\n',
      { APP_CONFIG }
    );

    if (electron.isElectron) {
      console.debug(
        '%c***** Run in electron *****',
        'background: #27B376; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
        '\n',
        { env: process.env }
      );
    } else {
      console.debug(
        '%c***** Run in browser *****',
        'background: #DC322F; color: #f8f8f8; padding: 10px;margin-bottom: 5px;'
      );
    }
  }
}
