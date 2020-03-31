import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { RedisModule } from 'nestjs-redis';
import { ConfigService } from '@nestjs/config';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

/**
 * set global-scoped redis module
 * providing `RedisService` and `RedisPubSub`
 */
@Global()
@Module({
  imports: [
    RedisModule.forRootAsync({
      useFactory: (configService: ConfigService) => configService.get('redis'),
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: RedisPubSub,
      useFactory: (configService: ConfigService) => {
        const options = Object.assign(
          {},
          configService.get('redis'),
        );
        return new RedisPubSub({
          subscriber: new Redis(options),
          publisher: new Redis(options),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    RedisModule,
    RedisPubSub,
  ],
})
export class WrappedRedisModule implements OnModuleDestroy {
  onModuleDestroy() {
    // TODO release the memory
  }
}
