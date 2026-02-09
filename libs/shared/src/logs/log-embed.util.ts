/** Плейсхолдер для отсутствующих данных в Embed. */
const NA = '—';

export interface LogEmbedField {
  name: string;
  value: string;
}

export interface LogEmbedData {
  title: string;
  description?: string;
  fields: LogEmbedField[];
}

export interface LogEventPayload {
  /** Участник (тег или имя). */
  userTag?: string | null;
  /** Discord ID пользователя. */
  userId?: string | null;
  /** Содержимое сообщения (для delete/edit). */
  messageContent?: string | null;
  /** Старое содержимое (для edit). */
  oldContent?: string | null;
  /** Новое содержимое (для edit). */
  newContent?: string | null;
  /** Название канала. */
  channelName?: string | null;
  /** Голосовой канал (для voice_change). */
  voiceChannelName?: string | null;
  /** Роли (для role_update). */
  rolesAdded?: string[] | null;
  rolesRemoved?: string[] | null;
  /** Время события (ISO строка). */
  timestamp?: string | null;
}

/**
 * Формирует данные для Embed лога по типу события и payload.
 * Не падает при отсутствии данных — подставляет NA.
 */
export function buildLogEmbedData(
  eventType: string,
  payload: LogEventPayload = {},
): LogEmbedData {
  const ts = payload.timestamp ?? new Date().toISOString();
  const user = payload.userTag ?? payload.userId ?? NA;
  const channel = payload.channelName ?? NA;
  const content =
    payload.messageContent != null && payload.messageContent !== ''
      ? payload.messageContent
      : NA;
  const oldContent =
    payload.oldContent != null && payload.oldContent !== ''
      ? payload.oldContent
      : NA;
  const newContent =
    payload.newContent != null && payload.newContent !== ''
      ? payload.newContent
      : NA;
  const voiceChannel = payload.voiceChannelName ?? NA;
  const rolesAdded = payload.rolesAdded?.length ? payload.rolesAdded.join(', ') : NA;
  const rolesRemoved = payload.rolesRemoved?.length ? payload.rolesRemoved.join(', ') : NA;

  switch (eventType) {
    case 'member_join':
      return {
        title: 'Участник присоединился',
        fields: [
          { name: 'Участник', value: user },
          { name: 'ID', value: payload.userId ?? NA },
          { name: 'Время', value: ts },
        ],
      };
    case 'member_leave':
      return {
        title: 'Участник вышел',
        fields: [
          { name: 'Участник', value: user },
          { name: 'ID', value: payload.userId ?? NA },
          { name: 'Время', value: ts },
        ],
      };
    case 'message_delete':
      return {
        title: 'Сообщение удалено',
        fields: [
          { name: 'Канал', value: channel },
          { name: 'Автор', value: user },
          { name: 'Содержимое', value: content.length > 1024 ? content.slice(0, 1021) + '...' : content },
          { name: 'Время', value: ts },
        ],
      };
    case 'message_edit':
      return {
        title: 'Сообщение изменено',
        fields: [
          { name: 'Канал', value: channel },
          { name: 'Автор', value: user },
          { name: 'Было', value: oldContent.length > 1024 ? oldContent.slice(0, 1021) + '...' : oldContent },
          { name: 'Стало', value: newContent.length > 1024 ? newContent.slice(0, 1021) + '...' : newContent },
          { name: 'Время', value: ts },
        ],
      };
    case 'message_create':
      return {
        title: 'Сообщение отправлено',
        fields: [
          { name: 'Канал', value: channel },
          { name: 'Автор', value: user },
          { name: 'Содержимое', value: content.length > 1024 ? content.slice(0, 1021) + '...' : content },
          { name: 'Время', value: ts },
        ],
      };
    case 'role_update':
      return {
        title: 'Обновление ролей',
        fields: [
          { name: 'Участник', value: user },
          { name: 'Добавлены', value: rolesAdded },
          { name: 'Сняты', value: rolesRemoved },
          { name: 'Время', value: ts },
        ],
      };
    case 'voice_change':
      return {
        title: 'Голосовой канал',
        fields: [
          { name: 'Участник', value: user },
          { name: 'Канал', value: voiceChannel },
          { name: 'Время', value: ts },
        ],
      };
    default:
      return {
        title: `Событие: ${eventType}`,
        fields: [
          { name: 'Участник', value: user },
          { name: 'Время', value: ts },
        ],
      };
  }
}
