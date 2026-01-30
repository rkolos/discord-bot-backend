import { Module } from '@nestjs/common';
import { SharedAnalyticsModule } from '@app/shared';
import { CommandsModule } from '../commands/commands.module';
import { InternalAnalyticsController } from './internal-analytics.controller';
import { InternalCommandsController } from './internal-commands.controller';

@Module({
  imports: [SharedAnalyticsModule, CommandsModule],
  controllers: [InternalAnalyticsController, InternalCommandsController],
})
export class InternalModule {}
