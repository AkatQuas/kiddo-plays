import { Component, OnInit, Inject } from '@angular/core';
import { ChargeService, Choice, History } from '../charge.service';
import { MatSnackBar, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

export interface DialogData {
  amount: number;
}

@Component({
  selector: 'app-dialog-ref-component',
  template: `<h1 mat-dialog-title>Charge Confirm</h1>
  <div mat-dialog-content>
    <p>Please confirm the amount</p>
    <p>$ {{data.amount}}</p>
  </div>
  <div mat-dialog-actions>
    <button mat-button (click)="onNoClick()">No Thanks</button>
    <button mat-button [mat-dialog-close]="true" cdkFocusInitial>Affirmative</button>
  </div>`
})
export class DialogRefComponent {

  constructor(
    public dialogRef: MatDialogRef<DialogRefComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) { }

  onNoClick(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-charge',
  templateUrl: './charge.component.html',
  styleUrls: ['./charge.component.less'],
})
export class ChargeComponent implements OnInit {
  choices: Choice[] = [];
  histories: History[] = [];
  constructor(
    private chargeService: ChargeService,
    private snackBar: MatSnackBar,
    public dialog: MatDialog
  ) { }

  ngOnInit() {
    this.getChoices();
    this.getRecentHistoryBy4();
  }
  getChoices() {
    this.chargeService.getChoices().subscribe(res => this.choices = res);
  }
  charge(value: number) {
    const ref = this.dialog.open(DialogRefComponent, { width: '300px', data: { amount: value } });
    ref.afterClosed().subscribe((result) => {
      if (result === true) {
        this.chargeService.postCharge(value).subscribe(res => {
          if (res != null) {
            this.snackBar.open('Charged successfully!', '', {
              duration: 1500
            });
            this.getRecentHistoryBy4();
          }
        });
      }
    });
  }
  getRecentHistoryBy4() {
    this.chargeService.getHistory().subscribe(res => {
      if (res !== null) {
        this.histories = res.splice(0, 4);
      }
    });
  }
}
