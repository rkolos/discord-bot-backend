import { Injectable, Scope } from '@nestjs/common';
import type { Guild } from '@app/shared';

/**
 * Request-scoped кэш гильдии: Guard сохраняет найденную гильдию,
 * GuildsService переиспользует её в том же запросе и не дублирует SELECT.
 */
@Injectable({ scope: Scope.REQUEST })
export class GuildContextService {
  private guild: Guild | null = null;

  setGuild(guild: Guild): void {
    this.guild = guild;
  }

  /** Возвращает гильдию из кэша, если idOrDiscordId совпадает с сохранённой. */
  getGuild(idOrDiscordId: string): Guild | null {
    if (!this.guild) return null;
    if (this.guild.id === idOrDiscordId || this.guild.discordGuildId === idOrDiscordId) {
      return this.guild;
    }
    return null;
  }
}
