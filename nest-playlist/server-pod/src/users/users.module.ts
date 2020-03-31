import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { errorHunter } from '../middleware/error-hunter.middleware';
import { UsersController } from './users.controller';
import { CatsModule } from '../cats/cats.module';

@Module({
  controllers: [
    UsersController,
  ],
  imports: [
    CatsModule,
  ],
})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(errorHunter)
      .forRoutes(UsersController);
  }
}
