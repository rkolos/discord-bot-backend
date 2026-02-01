import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IngestorModule } from './ingestor/ingestor.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    IngestorModule,
    HealthModule,
  ],
})
export class AppModule {}
