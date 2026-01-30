import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { InternalApiGuard } from './internal-api.guard';
import { GuildSyncInternalService } from './guild-sync-internal.service';

@Controller('internal/guilds')
@UseGuards(InternalApiGuard)
export class InternalGuildSyncController {
  constructor(private readonly guildSyncService: GuildSyncInternalService) {}

  @Post(':id/sync')
  async syncGuild(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: { success: boolean; syncedAt: string } }> {
    const result = await this.guildSyncService.syncGuild(id);
    return { data: result };
  }
}
