import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GuildsService } from '../guilds.service';
import { GuildContextService } from '../guild-context.service';
import { User } from '@app/shared';

/**
 * Защищает эндпоинты с :guildId. Сначала проверяет наличие гильдии в БД (404 при отсутствии),
 * затем права пользователя на гильдию по кэшу/Discord API (403 при отсутствии прав Administrator или Manage Guild).
 * Найденную гильдию кладёт в GuildContextService, чтобы в том же запросе не дублировать SELECT.
 */
@Injectable()
export class GuildAdminGuard implements CanActivate {
  constructor(
    private readonly guildsService: GuildsService,
    private readonly guildContext: GuildContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      params: { guildId?: string };
      user: User;
    }>();
    const guildId = request.params?.guildId;
    const user = request.user;
    if (!guildId || !user?.id) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Access denied to this guild',
      });
    }
    const guild = await this.guildsService.findGuildByIdOrDiscordId(guildId);
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: 'Guild not found',
      });
    }
    this.guildContext.setGuild(guild);
    const hasAccess = await this.guildsService.userHasGuildAdmin(user.id, guild.discordGuildId);
    if (!hasAccess) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Access denied to this guild',
      });
    }
    return true;
  }
}
