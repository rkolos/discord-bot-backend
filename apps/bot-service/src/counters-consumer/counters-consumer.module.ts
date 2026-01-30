import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Counter, Guild, SharedAnalyticsModule } from '@app/shared';
import { MultiTokenModule } from '../multi-token/multi-token.module';
import { CountersConsumerService } from './counters-consumer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Counter, Guild]),
    HttpModule.register({ timeout: 10_000 }),
    MultiTokenModule,
    SharedAnalyticsModule,
  ],
  providers: [CountersConsumerService],
})
export class CountersConsumerModule {}
