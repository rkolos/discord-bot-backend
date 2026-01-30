import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterCommandsDto {
  @IsString()
  @MinLength(1)
  token: string;

  @IsIn(['global', 'guild'])
  scope: 'global' | 'guild';

  @IsOptional()
  @IsString()
  @MinLength(1)
  guildId?: string;
}
