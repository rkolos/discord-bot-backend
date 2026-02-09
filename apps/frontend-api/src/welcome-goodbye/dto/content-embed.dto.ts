import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EMBED_TITLE_MAX_LENGTH,
  EMBED_DESCRIPTION_MAX_LENGTH,
  EMBED_FIELD_NAME_MAX_LENGTH,
  EMBED_FIELD_VALUE_MAX_LENGTH,
  EMBED_COLOR_MIN,
  EMBED_COLOR_MAX,
} from '../constants';

export class ContentEmbedFieldDto {
  @IsString()
  @MaxLength(EMBED_FIELD_NAME_MAX_LENGTH)
  name: string;

  @IsString()
  @MaxLength(EMBED_FIELD_VALUE_MAX_LENGTH)
  value: string;
}

export class ContentEmbedDto {
  @IsOptional()
  @IsString()
  @MaxLength(EMBED_TITLE_MAX_LENGTH)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(EMBED_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(EMBED_COLOR_MIN)
  @Max(EMBED_COLOR_MAX)
  color?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentEmbedFieldDto)
  fields?: ContentEmbedFieldDto[];
}
