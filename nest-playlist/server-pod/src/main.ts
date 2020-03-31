import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { TimingInterceptor } from './interceptor/timing.interceptor';
import { TransformInterceptor } from './interceptor/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const port = app.get(ConfigService).get('application.port');
  app.setGlobalPrefix('/api');
  app.useGlobalInterceptors(
    new TimingInterceptor(),
    new TransformInterceptor(),
  );
  await app.listen(port);
}
bootstrap();
