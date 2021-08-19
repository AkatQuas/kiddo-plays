import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypegooseModule } from 'nestjs-typegoose';
import { AppController } from 'src/app.controller';
import { AppService } from 'src/app.service';
import { Configuration } from 'src/configuration';
import { GraphqlModule } from 'src/graphql/graphql.module';
import { DaoModule } from './dao/dao.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 100,
    }),
    TypegooseModule.forRootAsync({
      useFactory: async (configService: ConfigService<Configuration>) => {
        return {
          uri: configService.get('MONGO_URI'),
          useNewUrlParser: true,
          useFindAndModify: false,
          useCreateIndex: true,
          useUnifiedTopology: true,
        };
      },
      inject: [ConfigService],
    }),
    DaoModule,
    GraphqlModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
