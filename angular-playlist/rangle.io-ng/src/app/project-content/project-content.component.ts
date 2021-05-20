import { Component, Input, OnInit, TemplateRef } from '@angular/core';

@Component({
  selector: 'app-project-content',
  templateUrl: './project-content.component.html',
  styleUrls: ['./project-content.component.less'],
})
export class ProjectContentComponent implements OnInit {
  @Input() headerTemplate: TemplateRef<HTMLElement>;
  @Input() bodyTemplate: TemplateRef<HTMLElement>;

  constructor() {}

  ngOnInit(): void {}
}
