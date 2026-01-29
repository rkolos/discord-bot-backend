import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PatchLogSettingItemDto } from './patch-log-setting-item.dto';

export class PatchLogSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PatchLogSettingItemDto)
  settings: PatchLogSettingItemDto[];
}
