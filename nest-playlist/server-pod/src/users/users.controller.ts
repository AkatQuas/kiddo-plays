import { Controller, Get, Param, UseGuards, Post, Put, Inject, Logger, UseInterceptors, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { RolesGuard } from '../guard/roles.guard';
import { setRoles } from './decorator/roles.decorator';
import { ConfigService } from '@nestjs/config';
import { CatsService } from '../cats/cats.service';
import { UserMonitorInterceptor } from './user-monitor.interceptor';

@Controller('users')
@UseGuards(RolesGuard)
@UseInterceptors(new UserMonitorInterceptor())
export class UsersController {
    @Inject()
    private readonly configService: ConfigService;

    @Inject()
    private readonly catsService: CatsService;

    @Get()
    async findAll(): Promise<any> {
        // Nest can return an `Observable`,
        // but you have to `subscribe` and `unsubscribe`,
        // be careful when using  `Observable`
        return {
            users: [],
        };
    }

    @Get('error-test')
    async throwError() {
        throw new BadRequestException({
            error: 'You can not put the role',
        });
    }

    @Post()
    @setRoles('admin')
    async create() {
        return true;
    }

    @Get(':id')
    async info(@Param('id') id: string): Promise<any> {
        const port = this.configService.get('application.port');
        Logger.log(
            `We have the port ${port} and it works well`,
        );
        const key = 'user_with_id_'.concat(id);

        const cat = await this.catsService.findByUser(id);
        const user = {
            id: id,
            name: key,
            cat,
        };
        return user;
    }

    @Put(':id')
    @setRoles('admin')
    async update(@Param('id') id: string): Promise<any> {
        Logger.debug(`Got id ${id}`);
        throw new HttpException('You can not put the role', HttpStatus.BAD_REQUEST);
    }

}
