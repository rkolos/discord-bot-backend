import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Body для PATCH /api/guilds/:guildId/modules.
 * Ключи — допустимые module_key (см. ALLOWED_MODULE_KEYS), значения — включён/выключен.
 */
export class PatchGuildModulesDto {
  @IsOptional()
  @IsBoolean()
  counters?: boolean;

  @IsOptional()
  @IsBoolean()
  analytics?: boolean;
}
