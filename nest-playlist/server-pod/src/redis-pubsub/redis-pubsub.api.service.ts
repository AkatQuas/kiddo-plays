import { Injectable, Inject } from '@nestjs/common';
import { RedisPubSub } from 'graphql-redis-subscriptions';

@Injectable()
export class RedisPusubService {
  @Inject()
  private readonly pubSub: RedisPubSub;

  async subscribeUserJoin(userId: string) {
    // To make this work,
    // first establish the connection from graphql playground
    // then `PUBLISH channel` in redis
    // example screenshot at `screenshots/graphql-redis-pubsub.png`
    return this.pubSub.asyncIterator(userId);
  }
}
