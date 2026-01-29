import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  IsSnowflake,
  SNOWFLAKE_STRING_MESSAGE,
  Snowflake,
  TransformToSnowflakeString,
} from './is-snowflake.decorator';

class DtoWithSnowflake {
  @Snowflake()
  guildId!: string;
}

class DtoWithSeparateDecorators {
  @TransformToSnowflakeString
  @IsSnowflake()
  id!: string;
}

describe('TransformToSnowflakeString', () => {
  it('leaves string as-is', () => {
    const plain = { guildId: '123456789012345678' };
    const instance = plainToInstance(DtoWithSnowflake, plain);
    expect(instance.guildId).toBe('123456789012345678');
  });

  it('converts safe integer to string', () => {
    const plain = { guildId: 1234567890123456 };
    const instance = plainToInstance(DtoWithSnowflake, plain);
    expect(instance.guildId).toBe('1234567890123456');
  });

  it('leaves unsafe number unchanged for validator to reject', () => {
    const plain = { id: Number.MAX_SAFE_INTEGER + 1 };
    const instance = plainToInstance(DtoWithSeparateDecorators, plain);
    expect(instance.id).toBe(Number.MAX_SAFE_INTEGER + 1);
  });
});

describe('IsSnowflake', () => {
  it('accepts valid 17-digit string', async () => {
    const instance = plainToInstance(DtoWithSnowflake, {
      guildId: '12345678901234567',
    });
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid 19-digit string', async () => {
    const instance = plainToInstance(DtoWithSnowflake, {
      guildId: '1234567890123456789',
    });
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
  });

  it('rejects number with message to pass as string', async () => {
    const instance = plainToInstance(DtoWithSeparateDecorators, {
      id: Number.MAX_SAFE_INTEGER + 1,
    });
    const errors = await validate(instance);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('id');
    expect(Object.values(errors[0].constraints ?? {})[0]).toBe(
      SNOWFLAKE_STRING_MESSAGE,
    );
  });

  it('rejects string that is too short', async () => {
    const instance = plainToInstance(DtoWithSnowflake, {
      guildId: '1234567890123456',
    });
    const errors = await validate(instance);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('guildId');
  });

  it('rejects string with non-digits', async () => {
    const instance = plainToInstance(DtoWithSnowflake, {
      guildId: '12345678901234567a',
    });
    const errors = await validate(instance);
    expect(errors).toHaveLength(1);
  });

  it('transform converts safe number to string; validator then requires 17–19 digits', async () => {
    const instance = plainToInstance(DtoWithSnowflake, {
      guildId: 1234567890123456,
    });
    expect(instance.guildId).toBe('1234567890123456');
    const errors = await validate(instance);
    expect(errors).toHaveLength(1);
  });
});
