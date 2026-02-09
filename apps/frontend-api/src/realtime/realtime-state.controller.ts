import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GuildIdParamDto } from '../guilds/dto/guild-id-param.dto';
import { GuildAdminGuard } from '../guilds/guards/guild-admin.guard';
import { RealtimeFullStateService } from './realtime-full-state.service';

@ApiTags('Realtime')
@ApiBearerAuth()
@Controller('guilds/:guildId/realtime')
@UseGuards(JwtAuthGuard, GuildAdminGuard)
export class RealtimeStateController {
  constructor(private readonly realtimeFullStateService: RealtimeFullStateService) {}

  @Post('emit-full-state')
  @ApiOperation({
    summary: 'Emit full guild-state to socket',
    description:
      'Sends all current guild-state parameters as guild-state events to the WebSocket room for this guild. Use after connecting and subscribing to initialize UI or debug socket messages. Events are delivered in the same format as real-time updates.',
  })
  async emitFullState(@Param() params: GuildIdParamDto): Promise<{ data: { emitted: number } }> {
    const emitted = await this.realtimeFullStateService.emitFullStateForGuild(params.guildId);
    return { data: { emitted } };
  }
}
