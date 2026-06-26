import { CommandFactory } from 'nest-commander';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { MyLogger } from './my.logger';

async function bootstrap() {
  await CommandFactory.run(AppModule, {
    logger: new MyLogger()
  });
}
bootstrap();
