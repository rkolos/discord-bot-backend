import { RedisContainer } from '@testcontainers/redis';
import { setTestIntegrationEnv } from '../../../../libs/shared/src/test-integration-env';

describe('VoiceSessionService integration (Redis voice join/leave)', () => {
  let container: { stop: () => Promise<unknown> };
  let voiceSession: import('./voice-session.service').VoiceSessionService;
  let nestRedis: { disconnect: () => void } | undefined;

  beforeAll(async () => {
    const started = await new RedisContainer('redis:7-alpine').start();
    container = started;

    setTestIntegrationEnv({
      NODE_ENV: 'test',
      REDIS_HOST: started.getHost(),
      REDIS_PORT: started.getPort(),
    });

    const { Test } = await import('@nestjs/testing');
    const { SharedConfigModule } = await import('@app/shared');
    const { RedisModule } = await import('@app/shared');
    const { VoiceSessionService } = await import('./voice-session.service');
    const { REDIS_CLIENT } = await import('@app/shared');

    const mod = await Test.createTestingModule({
      imports: [SharedConfigModule, RedisModule.forRootAsync()],
      providers: [VoiceSessionService],
    }).compile();

    voiceSession = mod.get(VoiceSessionService);
    nestRedis = mod.get(REDIS_CLIENT);
  }, 60_000);

  afterAll(async () => {
    nestRedis?.disconnect();
    if (container) await container.stop();
  }, 30_000);

  it('recordJoin -> recordLeave returns duration and voiceMinutes, key removed', async () => {
    const guildId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    const userId = '111222333444555678';
    const joinTime = Date.now();

    await voiceSession.recordJoin(guildId, userId);
    const leaveTime = joinTime + 125_000;
    const result = await voiceSession.recordLeave(guildId, userId, leaveTime);

    expect(result).not.toBeNull();
    expect(result!.durationSeconds).toBeGreaterThanOrEqual(124);
    expect(result!.durationSeconds).toBeLessThanOrEqual(126);
    expect(result!.voiceMinutes).toBe(3);

    const again = await voiceSession.recordLeave(guildId, userId);
    expect(again).toBeNull();
  });
});
