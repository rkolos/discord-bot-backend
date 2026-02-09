import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Snowflake } from '@app/shared';
import { WELCOME_GOODBYE_MESSAGE_TYPES } from '../constants';
import { ContentEmbedDto } from './content-embed.dto';
import { CONTENT_TEXT_MAX_LENGTH } from '../constants';

export class PatchWelcomeGoodbyeDto {
  @IsOptional()
  @ValidateIf((_o, v) => v != null)
  @Snowflake()
  channelId?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(WELCOME_GOODBYE_MESSAGE_TYPES, {
    message: 'messageType must be one of: text, embed, text_and_embed',
  })
  messageType?: 'text' | 'embed' | 'text_and_embed';

  @IsOptional()
  @IsString()
  @MaxLength(CONTENT_TEXT_MAX_LENGTH)
  contentText?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContentEmbedDto)
  contentEmbed?: ContentEmbedDto | null;
}
