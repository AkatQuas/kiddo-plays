import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { MatButtonModule, MatFormFieldModule, MatInputModule, MatCardModule, MatSnackBarModule, MatDialogModule } from '@angular/material';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { UserService } from './user.service';
import { NotFoundComponent } from './not-found/not-found.component';
import { HistoryComponent } from './history/history.component';
import { ChargeComponent, DialogRefComponent } from './charge/charge.component';
import { ChargeService } from './charge.service';
import { BackHeaderComponent } from './back-header/back-header.component';
import { HistoryItemComponent } from './history/history-item.component';

@NgModule({
  entryComponents: [
    DialogRefComponent
  ],
  declarations: [
    AppComponent,
    LoginComponent,
    DashboardComponent,
    NotFoundComponent,
    HistoryComponent,
    ChargeComponent,
    BackHeaderComponent,
    HistoryItemComponent,
    DialogRefComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
  ],
  providers: [ UserService, ChargeService],
  bootstrap: [AppComponent]
})
export class AppModule { }
