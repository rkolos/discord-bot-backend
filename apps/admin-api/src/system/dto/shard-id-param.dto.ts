import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ShardIdParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  id: number;
}
