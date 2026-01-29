import { IsSnowflake } from '@app/shared';

export class GuildIdParamDto {
  @IsSnowflake()
  guildId: string;
}
