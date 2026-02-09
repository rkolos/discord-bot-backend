import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FilteredBootstrapLogger } from '@app/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new FilteredBootstrapLogger(),
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();

  const port = process.env.PORT ?? process.env.HEALTH_PORT ?? 3003;
  await app.listen(port);

  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => resolve());
    process.on('SIGTERM', () => resolve());
  });

  await app.close();
}

void bootstrap();
