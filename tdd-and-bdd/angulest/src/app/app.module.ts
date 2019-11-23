import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { LightSwitchComponent } from './light-switch/light-switch.component';
import { DashboardComponent } from './hero/dashboard.component';
import { WelcomeComponent } from './welcome/welcome.component';
import { BannerComponent } from './banner/banner.component';
import { TeaComponent } from './tea/tea.component';
import { HighlightDirective } from './highlight.directive';
import { TitleCasePipe } from './title-case.pipe';
import { TwainComponent } from './twain/twain.component';

@NgModule({
  declarations: [
    AppComponent,
    LightSwitchComponent,
    DashboardComponent,
    WelcomeComponent,
    BannerComponent,
    TeaComponent,
    HighlightDirective,
    TitleCasePipe,
    TwainComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
