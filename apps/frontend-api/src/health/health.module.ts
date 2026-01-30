import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ClickHouseModule } from '@app/shared';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, ClickHouseModule.forRootAsync()],
  controllers: [HealthController],
})
export class HealthModule {}
