import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalApiGuard } from './internal-api.guard';
import { CommandRegistrationService } from '../commands/command-registration.service';
import { RegisterCommandsDto } from './dto/register-commands.dto';

@Controller('internal/commands')
@UseGuards(InternalApiGuard)
export class InternalCommandsController {
  constructor(private readonly commandRegistration: CommandRegistrationService) {}

  @Post('register')
  async register(@Body() dto: RegisterCommandsDto): Promise<{ ok: boolean }> {
    if (dto.scope === 'guild' && !dto.guildId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'guildId is required when scope is guild',
      });
    }
    if (dto.scope === 'global') {
      await this.commandRegistration.registerGlobalCommands(dto.token);
    } else {
      await this.commandRegistration.registerGuildCommands(dto.token, dto.guildId!);
    }
    return { ok: true };
  }
}
