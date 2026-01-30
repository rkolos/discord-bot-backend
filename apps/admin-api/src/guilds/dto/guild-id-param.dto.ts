import { IsUUID } from 'class-validator';

export class GuildIdParamDto {
  @IsUUID()
  id: string;
}
