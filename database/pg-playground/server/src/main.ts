import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  const config = app.get(ConfigService);
  const port = config.get().serverPort;
  await app.listen(port);
  console.log(`PG Playground server running on http://localhost:${port}`);
}

bootstrap();
