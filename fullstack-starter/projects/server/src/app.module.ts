import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { resolve } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { loadConfig } from './config/load-config';

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      load: [loadConfig],
      isGlobal: true,
    }),
    ServeStaticModule.forRoot({
      exclude: ['/api*'],
      rootPath: resolve(__dirname, '..', 'client'),
      serveStaticOptions: {
        // useful for fallback SPA
        index: 'index.html',
      }
    })
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
