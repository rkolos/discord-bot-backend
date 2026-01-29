import { Injectable } from '@nestjs/common';
import { RedisService } from '@app/shared';

const VOICE_JOIN_TTL_SECONDS = 86400; // 24 h

@Injectable()
export class VoiceSessionService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Сохраняет метку времени входа в голосовой канал.
   * Ключ: ingestor:voice:join:{guildId}:{userId} (префикс sn:{env}: применяется Redis).
   */
  async recordJoin(guildId: string, userId: string): Promise<void> {
    const key = this.voiceJoinKey(guildId, userId);
    const ts = Date.now().toString();
    await this.redis.set(key, ts, VOICE_JOIN_TTL_SECONDS);
  }

  /**
   * При выходе: читает время входа, удаляет ключ, возвращает длительность в секундах.
   * Если ключа нет (не был зафиксирован вход), возвращает null.
   */
  async recordLeave(
    guildId: string,
    userId: string,
    leaveTimeMs: number = Date.now(),
  ): Promise<{ durationSeconds: number; voiceMinutes: number } | null> {
    const key = this.voiceJoinKey(guildId, userId);
    const raw = await this.redis.get(key);
    await this.redis.del(key);
    if (raw == null || raw === '') return null;
    const joinMs = parseInt(raw, 10);
    if (Number.isNaN(joinMs)) return null;
    const durationSeconds = Math.max(0, Math.floor((leaveTimeMs - joinMs) / 1000));
    const voiceMinutes = Math.ceil(durationSeconds / 60);
    return { durationSeconds, voiceMinutes };
  }

  private voiceJoinKey(guildId: string, userId: string): string {
    return `ingestor:voice:join:${guildId}:${userId}`;
  }
}
