/** Поддерживаемые типы событий для логов гильдии. */
export const LOG_EVENT_TYPES = [
  'member_join',
  'member_leave',
  'message_delete',
  'message_edit',
  'role_update',
  'voice_change',
] as const;

export type LogEventType = (typeof LOG_EVENT_TYPES)[number];

/** Метаданные типов событий для фронта (id, name, description). */
export const LOG_EVENT_META: Array<{
  id: LogEventType;
  name: string;
  description: string;
}> = [
  { id: 'member_join', name: 'Участник присоединился', description: 'Логирование входа участника на сервер' },
  { id: 'member_leave', name: 'Участник вышел', description: 'Логирование выхода участника с сервера' },
  { id: 'message_delete', name: 'Сообщение удалено', description: 'Логирование удалённых сообщений' },
  { id: 'message_edit', name: 'Сообщение изменено', description: 'Логирование отредактированных сообщений' },
  { id: 'role_update', name: 'Обновление ролей', description: 'Логирование изменений ролей участников' },
  { id: 'voice_change', name: 'Голосовой канал', description: 'Логирование входов/выходов из голосовых каналов' },
];
