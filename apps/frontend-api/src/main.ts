import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';

function parseCorsOrigins(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from '@app/shared';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
}

void bootstrap();
