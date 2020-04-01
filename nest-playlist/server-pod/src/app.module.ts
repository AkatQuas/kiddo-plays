import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { TypegooseModule } from 'nestjs-typegoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { loadConfig } from './config/load-config';
import { CatsModule } from './cats/cats.module';
import { RecipesModule } from './recipes/recipes.module';
import { TasksModule } from './schedule/tasks.module';
import { UsersModule } from './users/users.module';
import { RedisPubsubModule } from './redis-pubsub/redis-pubsub.module';
import { WrappedRedisModule } from './shared/wrapped-redis.module';
import { WrappedHttpModule } from './shared/wrapped-http/wrapped-http.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      load: [loadConfig],
      isGlobal: true,
    }),
    TypegooseModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const uri = config.get("mongo.uri");
        Logger.debug(`connecting ${uri}`, 'TypegooseModule');
        return {
          uri,
          useNewUrlParser: true,
          useUnifiedTopology: true,
          useCreateIndex: true,
        };
      },
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),

    GraphQLModule.forRoot({
      useGlobalPrefix: true,
      subscriptions: { path: '/api/graphql', },
      debug: true,
      autoSchemaFile: './shared/official.gql',
      installSubscriptionHandlers: true,
    }),

    CatsModule,
    TasksModule,

    RecipesModule,

    UsersModule,

    RedisPubsubModule,

    WrappedRedisModule,
    WrappedHttpModule,
  ],
  controllers: [
    AppController,
  ],
  providers: [
    AppService,
  ],
})
export class AppModule {
}
