import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RawEventDto } from './raw-event.dto';

const validPayload = {
  eventId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  eventType: 'MESSAGE_CREATE',
  eventTime: '2025-01-15T12:00:00.000Z',
  guildId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  discordGuildId: '111222333444555678',
  discordUserId: '222333444555666789',
  channelId: '333444555666777890',
  planTier: 'free',
  payload: { foo: 'bar' },
};

async function validateDto(obj: unknown): Promise<string[]> {
  const dto = plainToInstance(RawEventDto, obj, {
    enableImplicitConversion: true,
  });
  const errors = await validate(dto);
  return errors.flatMap((e) =>
    e.constraints ? Object.values(e.constraints) : [],
  );
}

describe('RawEventDto validation', () => {
  it('accepts valid payload', async () => {
    const errs = await validateDto(validPayload);
    expect(errs).toHaveLength(0);
  });

  it('rejects invalid eventType', async () => {
    const errs = await validateDto({
      ...validPayload,
      eventType: 'INVALID_TYPE',
    });
    expect(errs.some((m) => m.includes('eventType') || m.includes('isIn'))).toBe(
      true,
    );
  });

  it('rejects invalid eventId (not UUID)', async () => {
    const errs = await validateDto({
      ...validPayload,
      eventId: 'not-a-uuid',
    });
    expect(errs.some((m) => m.includes('eventId') || m.includes('uuid'))).toBe(
      true,
    );
  });

  it('rejects invalid eventTime (not ISO 8601)', async () => {
    const errs = await validateDto({
      ...validPayload,
      eventTime: 'not-a-date',
    });
    expect(
      errs.some((m) => m.includes('eventTime') || m.includes('ISO')),
    ).toBe(true);
  });

  it('rejects invalid discordGuildId (not Snowflake)', async () => {
    const errs = await validateDto({
      ...validPayload,
      discordGuildId: '123',
    });
    expect(
      errs.some(
        (m) =>
          m.includes('discordGuildId') ||
          m.includes('Snowflake') ||
          m.includes('digits'),
      ),
    ).toBe(true);
  });

  it('accepts valid VOICE_STATE_UPDATE', async () => {
    const errs = await validateDto({
      ...validPayload,
      eventType: 'VOICE_STATE_UPDATE',
    });
    expect(errs).toHaveLength(0);
  });

  it('accepts valid GUILD_MEMBER_ADD', async () => {
    const errs = await validateDto({
      ...validPayload,
      eventType: 'GUILD_MEMBER_ADD',
    });
    expect(errs).toHaveLength(0);
  });

  it('accepts optional fields missing', async () => {
    const minimal = {
      eventId: validPayload.eventId,
      eventType: 'MESSAGE_CREATE',
      eventTime: validPayload.eventTime,
      guildId: validPayload.guildId,
      discordGuildId: validPayload.discordGuildId,
    };
    const errs = await validateDto(minimal);
    expect(errs).toHaveLength(0);
  });
});
