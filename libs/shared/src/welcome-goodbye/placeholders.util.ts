/** Контекст для подстановки плейсхолдеров в welcome/goodbye сообщениях */
export interface WelcomeGoodbyePlaceholderContext {
  /** Discord mention строки пользователя (например &lt;@123&gt;) */
  userMention: string;
  /** Имя пользователя (displayName или userTag) */
  username: string;
  /** Тег пользователя (username#discriminator или username) */
  userTag: string;
  /** Discord ID пользователя (Snowflake string) */
  userId: string;
  /** Имя сервера (гильдии) */
  serverName: string;
  /** Количество участников на сервере */
  memberCount: string;
}

const PLACEHOLDER_PAIRS: Array<[string, keyof WelcomeGoodbyePlaceholderContext]> = [
  ['{user}', 'userMention'],
  ['{username}', 'username'],
  ['{userTag}', 'userTag'],
  ['{userId}', 'userId'],
  ['{server}', 'serverName'],
  ['{memberCount}', 'memberCount'],
];

/**
 * Подставляет плейсхолдеры в строку.
 * Поддерживаемые плейсхолдеры: {user}, {username}, {userTag}, {userId}, {server}, {memberCount}.
 */
export function replacePlaceholders(
  text: string | null | undefined,
  context: WelcomeGoodbyePlaceholderContext,
): string {
  if (text == null || text === '') return '';
  let result = text;
  for (const [placeholder, key] of PLACEHOLDER_PAIRS) {
    const value = context[key] ?? '';
    result = result.split(placeholder).join(value);
  }
  return result;
}
