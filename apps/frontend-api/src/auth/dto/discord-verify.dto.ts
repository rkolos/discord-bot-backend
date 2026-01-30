import { IsNotEmpty, IsString } from 'class-validator';

export class DiscordVerifyDto {
  @IsString()
  @IsNotEmpty()
  discordToken: string;
}
