import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AllExceptionsFilter, FilteredBootstrapLogger } from '@app/shared';
import { AppModule } from './app.module';

function parseCorsOrigins(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new FilteredBootstrapLogger(),
  });
  app.useWebSocketAdapter(new IoAdapter(app));
  app.enableShutdownHooks();
  const corsOrigins = parseCorsOrigins(
    process.env.CORS_ORIGIN ?? process.env.FRONTEND_BASE_URL ?? 'http://localhost:3010',
  );
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.setGlobalPrefix('api', { exclude: ['health', 'docs'] });
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => new BadRequestException(errors),
    }),
  );
  app.use(cookieParser());

  const port = process.env.PORT ?? 3000;
  const serverUrl =
    process.env.FRONTEND_API_URL ?? `http://localhost:${port}`;

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Frontend API')
    .setDescription(
      'Public API. Authentication: Bearer JWT in Authorization header. All requests/responses use application/json. Envelope pattern: success in data, errors in error.',
    )
    .setVersion('1.0')
    .addServer(serverUrl, 'Local')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);

  const baseUrl = `http://127.0.0.1:${port}`;
  // Запустить подписчика Redis (RealtimeBootstrapService → subscriber.start())
  fetch(`${baseUrl}/api/internal/realtime/ping`).catch(() => {});
}

void bootstrap();
