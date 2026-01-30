import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandRegistry } from './command.registry';
import type { SlashCommandData } from './abstract.command';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

@Injectable()
export class CommandRegistrationService implements OnModuleInit {
  private readonly logger = new Logger(CommandRegistrationService.name);
  private readonly registry = new CommandRegistry();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const token = this.configService.get<string>('DISCORD_BOT_TOKEN');
    if (token && typeof token === 'string') {
      try {
        await this.registerGlobalCommands(token);
      } catch (err) {
        this.logger.warn(
          `Auto-register global commands failed: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Получить application id по токену бота (GET /applications/@me).
   */
  private async getApplicationId(token: string): Promise<string> {
    const res = await fetch(`${DISCORD_API_BASE}/applications/@me`, {
      method: 'GET',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to get application id: ${res.status} ${text}`);
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  /**
   * Зарегистрировать команды глобально (для основного бота).
   */
  async registerGlobalCommands(token: string): Promise<void> {
    const applicationId = await this.getApplicationId(token);
    const body = this.registry.getAllCommands().map((c) => c.data());
    await this.putCommands(token, applicationId, null, body);
    this.logger.log(`Registered ${body.length} global commands for application ${applicationId}`);
  }

  /**
   * Зарегистрировать команды для конкретной гильдии (для кастомных ботов).
   */
  async registerGuildCommands(token: string, discordGuildId: string): Promise<void> {
    const applicationId = await this.getApplicationId(token);
    const body = this.registry.getAllCommands().map((c) => c.data());
    await this.putCommands(token, applicationId, discordGuildId, body);
    this.logger.log(
      `Registered ${body.length} guild commands for application ${applicationId}, guild ${discordGuildId}`,
    );
  }

  private async putCommands(
    token: string,
    applicationId: string,
    discordGuildId: string | null,
    body: SlashCommandData[],
  ): Promise<void> {
    const path = discordGuildId
      ? `${DISCORD_API_BASE}/applications/${applicationId}/guilds/${discordGuildId}/commands`
      : `${DISCORD_API_BASE}/applications/${applicationId}/commands`;
    const res = await fetch(path, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to put commands: ${res.status} ${text}`);
    }
  }

  getRegistry(): CommandRegistry {
    return this.registry;
  }
}
