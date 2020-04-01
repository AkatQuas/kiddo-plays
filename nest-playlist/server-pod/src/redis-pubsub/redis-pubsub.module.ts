import { Module } from '@nestjs/common';
import { RedisPusubService } from './redis-pubsub.api.service';
import { RedisPubSubResolver } from './redis-pubsub.api.resolver';

@Module({
  providers: [
    RedisPubSubResolver,
    RedisPusubService,
  ]
})
export class RedisPubsubModule { }
