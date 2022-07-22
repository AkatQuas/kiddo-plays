import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CDPService } from '../core/services';
import { PortFormComponent } from './port-form/port-form.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit, OnDestroy {
  constructor(
    private router: Router,
    private CDP: CDPService,
    private snackBar: MatSnackBar,
    public dialog: MatDialog
  ) {}
  list: CDPJSON[];
  private _sub: Subscription;

  ngOnInit(): void {
    this._sub = this.CDP.getList().subscribe((list) => (this.list = list));
  }
  ngOnDestroy(): void {
    this._sub.unsubscribe();
  }
  goAbout() {
    this.router.navigate(['/about'], { replaceUrl: true });
  }

  doDebug(page: CDPJSON) {
    this.CDP.openDevtools(page);
  }
  refreshList() {
    this.CDP.refresh();
    this.snackBar.open('Refreshed');
  }
  addPort() {
    this.CDP.listPort().then((list) => {
      const dialogRef = this.dialog.open(PortFormComponent, {
        width: '300px',
        data: list,
      });
      dialogRef.afterClosed().subscribe((result: string[]) => {
        if (result === null) {
          return;
        }
        this.CDP.updatePorts(result);
      });
    });
  }
}
