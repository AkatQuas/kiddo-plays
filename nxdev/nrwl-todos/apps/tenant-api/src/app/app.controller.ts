import { Controller, Get } from '@nestjs/common';
import { Message } from '@nrwl-todos/api-interfaces';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('')
  get42(): Message {
    return this.appService.hello42();
  }

  @Get('hello')
  getHello(): Message {
    return this.appService.getData();
  }
}
