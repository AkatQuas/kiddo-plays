import { Logger } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthenticationError } from 'apollo-server-express';
import { generateFromString as generateAvatar } from 'generate-avatar';
import { UserService } from 'src/dao/user.service';
import {
  checkPassword,
  encryptPassword,
  generateJWT,
  UserJWT,
} from 'src/utils';

@Resolver('User')
export class UserResolver {
  private readonly logger = new Logger(UserResolver.name);

  constructor(private userService: UserService) {}

  @Query()
  async users() {
    return this.userService.find();
  }

  @Query()
  async user(@Args('username') username: string) {
    const filter = { username };
    try {
      return this.userService.findOne(filter);
    } catch (error) {
      this.logger.error(
        `Find User failed with condition: ${JSON.stringify(filter)}`,
      );
      return null;
    }
  }

  @Query()
  async me(@Context('user') user: UserJWT) {
    try {
      return this.userService.findById(user.id);
    } catch (error) {
      this.logger.error(`Find User by id failed: ${user.id}`);
      return null;
    }
  }

  /**
   * @deprecated
   * @param username
   * @param password
   * @returns
   */
  @Mutation()
  async signUp(
    @Args('username') username: string,
    @Args('password') password: string,
  ) {
    try {
      const hashed = await encryptPassword(password);
      const avatar = generateAvatar(username);
      const user = await this.userService.create({
        username,
        password: hashed,
        avatar,
      });
      return generateJWT(user);
    } catch (error) {
      this.logger.error(error);
      throw new Error('Error creating account');
    }
  }

  /**
   * @deprecated
   * @param username
   * @param password
   * @returns
   */
  @Mutation()
  async signIn(
    @Args('username') username: string,
    @Args('password') password: string,
  ) {
    const user = await this.userService.findOne({ username }, true);
    if (!user) {
      throw new AuthenticationError('Error Sign In: User not exist');
    }

    const valid = await checkPassword(password, user.password);
    if (!valid) {
      throw new AuthenticationError(
        'Error Sign In: wrong username or password',
      );
    }

    return generateJWT(user);
  }
}
