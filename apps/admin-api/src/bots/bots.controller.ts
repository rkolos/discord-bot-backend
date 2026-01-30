import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { RegisterCommandsDto } from './dto/register-commands.dto';
import { BotsService } from './bots.service';

@Controller('api/bots')
@UseGuards(AdminAuthGuard)
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post('commands/register')
  async registerCommands(@Body() dto: RegisterCommandsDto): Promise<{ ok: boolean }> {
    if (dto.scope === 'guild' && !dto.guildId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'guildId is required when scope is guild',
      });
    }
    await this.botsService.registerCommands(dto);
    return { ok: true };
  }
}
