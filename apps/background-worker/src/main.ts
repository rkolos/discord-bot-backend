import { NestFactory } from '@nestjs/core';
import { FilteredBootstrapLogger } from '@app/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const _app = await NestFactory.create(AppModule, {
    logger: new FilteredBootstrapLogger(),
  });
  // Worker: no HTTP port; process kept alive until worker logic is implemented
  await new Promise(() => {});
}

void bootstrap();
