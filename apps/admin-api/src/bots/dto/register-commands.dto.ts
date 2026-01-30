import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { IsSnowflake } from '@app/shared';

export class RegisterCommandsDto {
  @IsString()
  @MinLength(1)
  token: string;

  @IsIn(['global', 'guild'])
  scope: 'global' | 'guild';

  @IsOptional()
  @IsSnowflake()
  guildId?: string;
}
