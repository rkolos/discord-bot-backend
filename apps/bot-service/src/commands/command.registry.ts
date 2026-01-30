import { AbstractCommand } from './abstract.command';
import { PingCommand } from './ping.command';
import { StatsCommand } from './stats.command';

const COMMANDS: AbstractCommand[] = [
  new PingCommand(),
  new StatsCommand(),
];

/**
 * Централизованный реестр всех slash-команд проекта. Используется для регистрации в Discord и для выполнения по имени.
 */
export class CommandRegistry {
  private readonly byName = new Map<string, AbstractCommand>();

  constructor(commands: AbstractCommand[] = COMMANDS) {
    for (const cmd of commands) {
      this.byName.set(cmd.name, cmd);
    }
  }

  getAllCommands(): AbstractCommand[] {
    return Array.from(this.byName.values());
  }

  getByName(name: string): AbstractCommand | undefined {
    return this.byName.get(name);
  }
}
