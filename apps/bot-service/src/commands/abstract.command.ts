import type { CommandContext } from './command-context.types';

/**
 * JSON-описание команды для Discord API (PUT /applications/{id}/commands).
 * Соответствует RESTPostAPIChatInputApplicationCommandsJSONBody (Discord API v10).
 */
export interface SlashCommandData {
  name: string;
  description: string;
  type?: number;
  options?: Array<{
    name: string;
    description: string;
    type: number;
    required?: boolean;
  }>;
}

/**
 * Базовый класс для всех slash-команд. Реестр вызывает data() для регистрации и execute() при взаимодействии.
 */
export abstract class AbstractCommand {
  abstract readonly name: string;

  /** Описание команды для Discord API (регистрация). */
  abstract data(): SlashCommandData;

  /** Выполнение команды при получении interaction. */
  abstract execute(context: CommandContext): Promise<void>;
}
