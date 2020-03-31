import { Resolver, Subscription, Args } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';
import { Inject, Logger } from '@nestjs/common';
import { RedisPusubService } from './redis-pubsub.api.service';


@Resolver()
export class RedisPubSubResolver {
  @Inject()
  private readonly redisPubSubService: RedisPusubService;

  @Subscription(returns => GraphQLJSONObject, {
    defaultValue: {},
    resolve: (payload, args, context, info) => {
      Logger.debug(payload);
      Logger.debug(args);
      Logger.debug(context);
      Logger.debug(info);
      return {
        data: payload,
      };
    },
  })
  async subscribeUserJoin(@Args('userId') userId: string): Promise<AsyncIterator<any>> {
    Logger.debug(`subscribe to user ${userId}`);
    return this.redisPubSubService.subscribeUserJoin(userId);
  }
}
