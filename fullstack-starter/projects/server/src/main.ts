import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { TimingInterceptor } from './timing.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const applicationConfig = app.get(ConfigService).get('application');

  app.setGlobalPrefix('/api');

  app.useGlobalInterceptors(
    new TimingInterceptor(),
  );

  await app.listen(
    applicationConfig.port
  );
}

bootstrap();
