import { IsGuildId } from '@app/shared';

export class GuildIdParamDto {
  @IsGuildId()
  guildId: string;
}
