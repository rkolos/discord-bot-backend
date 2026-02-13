import {
  IsOptional,
  IsArray,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class EventsSearchCursorDto {
  @IsString()
  eventId!: string;

  @IsString()
  eventTime!: string;
}

export class EventsSearchQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  eventTypes?: string[];

  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EventsSearchCursorDto)
  cursor?: { eventId: string; eventTime: string };
}
