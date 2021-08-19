import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 9000;

  app.setGlobalPrefix('/api');
  app.enableCors({
    credentials: true,
  });
  app.use(
    helmet({
      contentSecurityPolicy:
        configService.get('NODE_ENV') === 'production' ? undefined : false,
    }),
  );

  await app.listen(port, () => {
    console.log(`🎸 Server ready at http://localhost:${port}/api`);
  });
}
bootstrap();
