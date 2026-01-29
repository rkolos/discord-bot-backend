import { IsOptional, IsString, MinLength } from 'class-validator';
import { Snowflake } from '@app/shared';

export class OnboardGuildDto {
  @Snowflake()
  discordGuildId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
