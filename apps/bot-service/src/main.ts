import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const _app = await NestFactory.create(AppModule);
  // Worker: no HTTP port; process kept alive until worker logic is implemented
  await new Promise(() => {});
}

void bootstrap();
