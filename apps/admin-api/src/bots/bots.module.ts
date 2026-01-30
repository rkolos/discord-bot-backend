import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';

@Module({
  imports: [ConfigModule],
  controllers: [BotsController],
  providers: [BotsService],
  exports: [BotsService],
})
export class BotsModule {}
