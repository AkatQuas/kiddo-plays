import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';
import { BloodTestMiddleware } from './blood-test.middleware';
import { LoggerModule } from '../logger/logger.module';
import { Cat } from './cat.model';

@Module({
    imports: [
        TypegooseModule.forFeature([Cat]),
        LoggerModule,
    ],
    controllers: [
        CatsController,
    ],
    providers: [
        CatsService,
    ],
    exports: [
        CatsService,
    ]
})
export class CatsModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(BloodTestMiddleware)
            .forRoutes('cats');
    }
}
