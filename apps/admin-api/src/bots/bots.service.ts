import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RegisterCommandsDto } from './dto/register-commands.dto';

@Injectable()
export class BotsService {
  private readonly logger = new Logger(BotsService.name);

  constructor(private readonly configService: ConfigService) {}

  async registerCommands(dto: RegisterCommandsDto): Promise<void> {
    const baseUrl = this.configService.get<string>('BOT_SERVICE_INTERNAL_BASE_URL');
    if (!baseUrl || typeof baseUrl !== 'string') {
      throw new Error('BOT_SERVICE_INTERNAL_BASE_URL is not set');
    }
    const url = `${baseUrl.replace(/\/$/, '')}/internal/commands/register`;
    const secret = this.configService.get<string>('INTERNAL_API_SECRET');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(secret && { 'X-Internal-Secret': secret }),
    };
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token: dto.token,
        scope: dto.scope,
        guildId: dto.guildId,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`Bot-service register commands failed: ${res.status} ${text}`);
      throw new Error(`Bot-service returned ${res.status}: ${text}`);
    }
  }
}
