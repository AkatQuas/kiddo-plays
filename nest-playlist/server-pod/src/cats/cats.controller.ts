import { Controller, Post, Get, HttpCode, Param, Put, Body, Delete, Query, Logger, Inject } from '@nestjs/common';
import { ListAllEntities } from './cats.dto';
import { CatsService } from './cats.service';
import { Cat } from './cat.model';
import { ConfigService } from '@nestjs/config';
import { MyLogger } from '../logger/my-logger.service';
// import { JoiValidationPipe } from '../common/pipe/joi-validation.pipe';

@Controller('cats')
export class CatsController {
    @Inject()
    private readonly catsService: CatsService;

    @Inject()
    private readonly configService: ConfigService;

    @Inject()
    private readonly myLogger: MyLogger;

    @Get()
    async findAll(@Query() query: Object & ListAllEntities): Promise<{ cats: Cat[]; }> {
        Logger.error(`ERROR: This action returns all cats (limit: ${query.limit} items, and skip: ${query.skip})`);
        const cats = await this.catsService.findAll();
        const port = this.configService.get('application.port');
        Logger.log(
            `We have the port ${port} and it works well`,
        );
        Logger.warn(`WARN: This action retrieve all data via promise`);
        return { cats };
    }

    @Post()
    @HttpCode(204)
    // @UsePipes(new JoiValidationPipe(createCatSchema))
    create(@Body() createCatDto: Cat): string {
        this.catsService.create(createCatDto);
        return 'This action adds a new cat';
    }

    @Get(':id')
    async findOne(@Param() params): Promise<Cat> {
        this.myLogger.info(`My Logger INFO: This action retrieve only one data via promise`);
        return this.catsService.findById(params.id);
    }

    @Put(':id')
    @HttpCode(204)
    updateOne(@Param('id') id, @Body() updateCatDto: Cat): string {
        Logger.log(`Got body ${updateCatDto}`);
        return `This action put a #${id} cat`;
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        Logger.warn(`Got body ${id}`);
        return `This action removes a #${id} cat`;
    }
}
