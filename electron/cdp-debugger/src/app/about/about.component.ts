import { Component, Inject, OnInit } from '@angular/core';
import { ElectronService } from '../core/services';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
})
export class AboutComponent implements OnInit {
  constructor(
    @Inject(ElectronService) private readonly electron: ElectronService
  ) {}

  ngOnInit(): void {}

  open(url: string) {
    this.electron.ipcRenderer.send('SHELL:open', url);
  }
}
