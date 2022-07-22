import { Component, Inject, OnInit } from '@angular/core';

import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-port-form',
  templateUrl: './port-form.component.html',
  styleUrls: ['./port-form.component.scss'],
})
export class PortFormComponent implements OnInit {
  list: string[];
  port: string;
  constructor(
    public dialogRef: MatDialogRef<PortFormComponent, string[]>,
    @Inject(MAT_DIALOG_DATA) public data: string[]
  ) {
    this.list = this.data.slice();
  }

  ngOnInit(): void {}

  handleClose(): void {
    this.dialogRef.close(null);
  }
  handleSave(): void {
    this.dialogRef.close(this.list);
  }
  remove(index: number) {
    this.list.splice(index, 1);
  }
  handleAdd() {
    try {
      const parsed = parseInt(this.port, 10);
      if (parsed > 3000) {
        this.list.push(parsed.toString());
      } else {
      }
    } catch (error) {
    } finally {
      this.port = '';
    }
  }
}
