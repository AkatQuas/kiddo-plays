import { Injectable } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { DemoService } from './demo.service';

@Injectable()
@Command({ name: 'test', description: '纯DI测试命令' })
export class TestCommand extends CommandRunner {
  constructor(private readonly demo: DemoService) {
    super();
  }

  async run(): Promise<void> {
    console.log(this.demo.sayHello('cli'));
  }
}
