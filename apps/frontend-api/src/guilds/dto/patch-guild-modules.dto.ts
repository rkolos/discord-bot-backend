import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { ALLOWED_MODULE_KEYS } from '../constants';

/**
 * Body для PATCH /api/guilds/:guildId/modules.
 * Два формата:
 * 1) Один модуль: { moduleId: string, enabled: boolean } (moduleId — ключ из ALLOWED_MODULE_KEYS).
 * 2) Несколько модулей: объект с ключами counters?, analytics? и булевыми значениями.
 */
export class PatchGuildModulesDto {
  /** Ключ модуля (counters | analytics). При наличии обновляется один модуль. */
  @IsOptional()
  @IsString()
  @IsIn([...ALLOWED_MODULE_KEYS])
  moduleId?: string;

  /** Включён ли модуль. Используется вместе с moduleId. */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  counters?: boolean;

  @IsOptional()
  @IsBoolean()
  analytics?: boolean;
}
