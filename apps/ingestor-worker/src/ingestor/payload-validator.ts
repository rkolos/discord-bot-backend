/**
 * Валидация структуры payload по типу события.
 * Невалидные события отсекаются до записи в ClickHouse.
 */
import type { IngestorEventType } from './constants';

export interface PayloadValidationResult {
  valid: boolean;
  reason?: string;
}

function hasNonEmptyString(obj: unknown, key: string): boolean {
  if (obj == null || typeof obj !== 'object') return false;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * Проверяет, что payload и top-level поля DTO соответствуют минимальным требованиям для типа события.
 * При невалидности возвращает { valid: false, reason } — событие не должно записываться в ClickHouse.
 */
export function validatePayloadByEventType(
  eventType: IngestorEventType,
  payload: Record<string, unknown> | null | undefined,
  topLevel: {
    channelId?: string | null;
    discordUserId?: string | null;
    userId?: string | null;
    commandName?: string | null;
  },
): PayloadValidationResult {
  const p = payload ?? {};

  switch (eventType) {
    case 'MESSAGE_CREATE': {
      const channelId =
        topLevel.channelId ?? (p.channelId as string | undefined);
      if (!hasNonEmptyString({ channelId }, 'channelId')) {
        return {
          valid: false,
          reason: 'MESSAGE_CREATE requires channelId in payload or top-level',
        };
      }
      return { valid: true };
    }

    case 'VOICE_STATE_UPDATE':
    case 'voice_change': {
      return { valid: true };
    }

    case 'INTERACTION_CREATE': {
      const commandName =
        topLevel.commandName ?? (p.commandName as string | undefined);
      if (!hasNonEmptyString({ commandName }, 'commandName')) {
        return {
          valid: false,
          reason: 'INTERACTION_CREATE requires commandName in payload or top-level',
        };
      }
      return { valid: true };
    }

    case 'GUILD_MEMBER_ADD':
    case 'GUILD_MEMBER_REMOVE':
    case 'GUILD_MEMBER_UPDATE':
    case 'MESSAGE_UPDATE':
    case 'MESSAGE_DELETE':
    case 'THREAD_CREATE':
    case 'GUILD_CREATE':
    case 'GUILD_DELETE':
    case 'PRESENCE_UPDATE': {
      return { valid: true };
    }

    default: {
      return { valid: true };
    }
  }
}
