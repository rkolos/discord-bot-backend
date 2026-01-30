import {
  validatePayloadByEventType,
  type PayloadValidationResult,
} from './payload-validator';

describe('validatePayloadByEventType', () => {
  it('MESSAGE_CREATE: valid when channelId in top-level', () => {
    const r: PayloadValidationResult = validatePayloadByEventType(
      'MESSAGE_CREATE',
      {},
      { channelId: '123' },
    );
    expect(r.valid).toBe(true);
  });

  it('MESSAGE_CREATE: valid when channelId in payload', () => {
    const r: PayloadValidationResult = validatePayloadByEventType(
      'MESSAGE_CREATE',
      { channelId: '456' },
      {},
    );
    expect(r.valid).toBe(true);
  });

  it('MESSAGE_CREATE: invalid when channelId missing', () => {
    const r: PayloadValidationResult = validatePayloadByEventType(
      'MESSAGE_CREATE',
      {},
      {},
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('channelId');
  });

  it('INTERACTION_CREATE: valid when commandName in top-level', () => {
    const r: PayloadValidationResult = validatePayloadByEventType(
      'INTERACTION_CREATE',
      {},
      { commandName: 'stats' },
    );
    expect(r.valid).toBe(true);
  });

  it('INTERACTION_CREATE: valid when commandName in payload', () => {
    const r: PayloadValidationResult = validatePayloadByEventType(
      'INTERACTION_CREATE',
      { commandName: 'help' },
      {},
    );
    expect(r.valid).toBe(true);
  });

  it('INTERACTION_CREATE: invalid when commandName missing', () => {
    const r: PayloadValidationResult = validatePayloadByEventType(
      'INTERACTION_CREATE',
      {},
      {},
    );
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('commandName');
  });

  it('INTERACTION_CREATE: invalid when commandName empty string', () => {
    const r: PayloadValidationResult = validatePayloadByEventType(
      'INTERACTION_CREATE',
      { commandName: '' },
      {},
    );
    expect(r.valid).toBe(false);
  });

  it('VOICE_STATE_UPDATE: always valid', () => {
    expect(
      validatePayloadByEventType('VOICE_STATE_UPDATE', {}, {}).valid,
    ).toBe(true);
  });

  it('GUILD_MEMBER_ADD and GUILD_MEMBER_REMOVE: always valid', () => {
    expect(
      validatePayloadByEventType('GUILD_MEMBER_ADD', null, {}).valid,
    ).toBe(true);
    expect(
      validatePayloadByEventType('GUILD_MEMBER_REMOVE', undefined, {}).valid,
    ).toBe(true);
  });
});
