import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { GuildsService } from '../guilds.service';
import { User } from '@app/shared';

@Injectable()
export class GuildAdminGuard implements CanActivate {
  constructor(private readonly guildsService: GuildsService) {}

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
    const hasAccess = await this.guildsService.userHasGuildAdmin(user.id, guildId);
    if (!hasAccess) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Access denied to this guild',
      });
    }
    return true;
  }
}
