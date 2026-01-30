import { createHash } from 'crypto';

/**
 * Вычисляет необратимый хэш для связи событий в ClickHouse без хранения Discord ID.
 * Один и тот же discordUserId при одинаковой соли всегда даёт один и тот же результат.
 *
 * @param discordUserId — Discord Snowflake ID пользователя (string)
 * @param salt — статичная соль сервера (из конфига)
 * @returns SHA-256 hex строка (64 символа)
 */
export function computeAnonymizedHash(
  discordUserId: string,
  salt: string,
): string {
  return createHash('sha256')
    .update(salt + discordUserId, 'utf8')
    .digest('hex');
}
