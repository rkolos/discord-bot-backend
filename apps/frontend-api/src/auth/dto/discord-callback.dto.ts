import { IsNotEmpty, IsString } from 'class-validator';

export class DiscordCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  state: string;
}
