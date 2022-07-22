import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { TranslateModule } from '@ngx-translate/core';

import { FormsModule } from '@angular/forms';

import { PageNotFoundComponent } from './components/';
import { WebviewDirective } from './directives/';
import { TruncatePipe } from './pipes';

@NgModule({
  declarations: [PageNotFoundComponent, WebviewDirective, TruncatePipe],
  imports: [
    CommonModule,
    TranslateModule,
    FormsModule,

    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatSnackBarModule,
  ],
  exports: [
    FormsModule,
    TranslateModule,

    WebviewDirective,
    TruncatePipe,

    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatSnackBarModule,
  ],
})
export class SharedModule {}
