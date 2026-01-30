import { Module } from '@nestjs/common';
import { IngestorModule } from './ingestor/ingestor.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [IngestorModule, HealthModule],
})
export class AppModule {}
