import { Component, OnInit } from '@angular/core';
import { MessageService } from "../message.service";

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.less']
})
export class MessagesComponent implements OnInit {
  icon = require('../icon/icon.jpg');
  constructor(public messageService: MessageService) { }

  ngOnInit() {
  }

}
