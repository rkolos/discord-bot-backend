import { IsUUID } from 'class-validator';
import { IsSnowflake } from '@app/shared';

export class GuildAndCounterIdParamDto {
  @IsSnowflake()
  guildId: string;

  @IsUUID('4')
  id: string;
}
