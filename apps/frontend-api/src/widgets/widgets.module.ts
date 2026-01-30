import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Widget } from '@app/shared';
import { GuildsModule } from '../guilds/guilds.module';
import { WidgetsController } from './widgets.controller';
import { WidgetsPublicController } from './widgets-public.controller';
import { WidgetsService } from './widgets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Widget]), GuildsModule],
  controllers: [WidgetsController, WidgetsPublicController],
  providers: [WidgetsService],
  exports: [WidgetsService],
})
export class WidgetsModule {}
