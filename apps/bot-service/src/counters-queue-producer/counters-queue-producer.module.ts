import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Counter, SharedConfigModule } from '@app/shared';
import { CountersQueueProducerService } from './counters-queue-producer.service';

@Module({
  imports: [SharedConfigModule, TypeOrmModule.forFeature([Counter])],
  providers: [CountersQueueProducerService],
  exports: [CountersQueueProducerService],
})
export class CountersQueueProducerModule {}
