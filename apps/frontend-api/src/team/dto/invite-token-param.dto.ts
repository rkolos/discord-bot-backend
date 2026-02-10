import { IsString, MinLength } from 'class-validator';

export class InviteTokenParamDto {
  @IsString()
  @MinLength(1)
  token: string;
}
