/**
 * DTO ответа GET /api/guilds — гильдия пользователя из Discord с флагом наличия бота в нашей БД.
 * id — Discord Guild ID (Snowflake), всегда string.
 */
export interface UserGuildDto {
  id: string;
  name: string;
  icon: string;
  owner: boolean;
  permissions: string;
  isBotAdded: boolean;
}
