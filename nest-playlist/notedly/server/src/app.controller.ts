import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthenticationError } from 'apollo-server-express';
import { generateFromString as generateAvatar } from 'generate-avatar';
import { AppService } from 'src/app.service';
import { CreateUserDto } from 'src/dao/schemas';
import { UserService } from 'src/dao/user.service';
import { checkPassword, encryptPassword, generateJWT } from 'src/utils';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly userService: UserService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('/sign-up')
  async signUp(
    @Body() createUserDto: CreateUserDto,
  ): Promise<{ token: string }> {
    try {
      const { password, username } = createUserDto;
      const hashed = await encryptPassword(password);
      const avatar = generateAvatar(username);
      const user = await this.userService.create({
        username,
        password: hashed,
        avatar,
      });
      return {
        token: await generateJWT(user),
      };
    } catch (error) {
      throw new Error('Error creating account');
    }
  }

  @Post('/sign-in')
  async signIn(
    @Body('username') username: string,
    @Body('password') password: string,
  ): Promise<{ token: string }> {
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

    return {
      token: await generateJWT(user),
    };
  }
}
