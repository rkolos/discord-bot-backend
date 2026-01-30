import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ShardingModule } from '../sharding/sharding.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, ShardingModule],
  controllers: [HealthController],
})
export class HealthModule {}
