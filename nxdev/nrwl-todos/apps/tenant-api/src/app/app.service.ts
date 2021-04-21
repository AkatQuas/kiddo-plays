import { Injectable } from '@nestjs/common';
import { Message } from '@nrwl-todos/api-interfaces';

@Injectable()
export class AppService {
  hello42(): Message {
    return { message: 'Hello 42!' };
  }
  getData(): Message {
    return { message: 'Welcome to api!' };
  }
}
