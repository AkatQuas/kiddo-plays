import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CounterChangeComponent } from './counter-change/counter-change.component';
import { CounterComponent } from './counter/counter.component';
import { FormatFileSizePipe } from './format-file-size.pipe';
import { HelloListComponent } from './hello-list/hello-list.component';
import { HelloComponent } from './hello-list/hello.component';
import { ProjectContentComponent } from './project-content/project-content.component';
import { RayModule } from './ray/ray.module';
import { OpenCloseComponent } from './open-close/open-close.component';

@NgModule({
  declarations: [
    AppComponent,
    CounterComponent,
    CounterChangeComponent,
    ProjectContentComponent,
    HelloListComponent,
    HelloComponent,
    FormatFileSizePipe,
    OpenCloseComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    RayModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
