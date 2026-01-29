import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class TopMembersQueryDto {
  @IsOptional()
  @IsIn(['messages', 'voice'])
  sortBy?: 'messages' | 'voice' = 'messages';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
