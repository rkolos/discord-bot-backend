import { Module } from '@nestjs/common';
import { CommandRegistrationService } from './command-registration.service';

@Module({
  providers: [CommandRegistrationService],
  exports: [CommandRegistrationService],
})
export class CommandsModule {}
