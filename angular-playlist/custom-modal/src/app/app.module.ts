import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { HeaderComponent } from './header/header.component';
import { LoginComponent } from './login/login.component';
import { ModalService } from './modal-service.service';
import { CounterComponent } from './counter/counter.component';
import { LazyInputComponent } from './lazy-input/lazy-input.component';
import { ProgressComponent } from './progress/progress.component';
import { SvgBoxComponent } from './svg-box/svg-box.component';
import { BoxComponent } from './svg-box/box.component';
import { SimpleNgFor } from './simple-ngfor.directive';
import { ZoneSvgComponent } from './zone-svg/zone-svg.component';
import { ZoneBoxComponent } from './zone-svg/zone-box.component';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    LoginComponent,
    CounterComponent,
    LazyInputComponent,
    ProgressComponent,
    SvgBoxComponent,
    BoxComponent,
    SimpleNgFor,
    ZoneSvgComponent,
    ZoneBoxComponent,
  ],
  imports: [
    ReactiveFormsModule,
    FormsModule,
    BrowserModule.withServerTransition({ appId: 'custom' }),
  ],
  providers: [
    ModalService,
  ],
  entryComponents: [
    LoginComponent,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
