import { Query, Resolver } from '@nestjs/graphql';

@Resolver('Hello')
export class HelloResolver {
  @Query('hello')
  async getHello() {
    return '42!world';
  }

  @Query()
  async c() {
    return new Date();
  }

  @Query()
  async b() {
    return new Date();
  }

  @Query()
  async j() {
    return {
      json: 'hello',
      42: 'world',
    };
  }
}
