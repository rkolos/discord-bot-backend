import { ArgumentMetadata } from '@nestjs/common';
import { SNOWFLAKE_STRING_MESSAGE } from './is-snowflake.decorator';
import { SnowflakePipe } from './snowflake.pipe';

const metadata: ArgumentMetadata = {
  type: 'param',
  data: 'id',
  metatype: String,
};

describe('SnowflakePipe', () => {
  const pipe = new SnowflakePipe();

  it('returns string as-is', () => {
    expect(pipe.transform('123456789012345678', metadata)).toBe(
      '123456789012345678',
    );
  });

  it('converts number to string', () => {
    const n = 1234567890123456;
    expect(pipe.transform(n, metadata)).toBe(String(n));
  });

  it('converts array first element (string) to string', () => {
    expect(pipe.transform(['987654321098765432'], metadata)).toBe(
      '987654321098765432',
    );
  });

  it('converts array first element (number) to string', () => {
    const n = 1112223334445556;
    expect(pipe.transform([n], metadata)).toBe(String(n));
  });

  it('throws when value is null', () => {
    expect(() => pipe.transform(null, metadata)).toThrow(
      'Snowflake ID is required',
    );
  });

  it('throws when value is undefined', () => {
    expect(() => pipe.transform(undefined, metadata)).toThrow(
      'Snowflake ID is required',
    );
  });

  it('throws when array is empty', () => {
    expect(() => pipe.transform([], metadata)).toThrow('Invalid Snowflake ID');
  });

  it('throws when array first element is invalid type', () => {
    expect(() => pipe.transform([{}], metadata)).toThrow('Invalid Snowflake ID');
    expect(() => pipe.transform([null], metadata)).toThrow('Invalid Snowflake ID');
  });

  it('throws when value is object', () => {
    expect(() => pipe.transform({ id: '123' }, metadata)).toThrow(
      'Invalid Snowflake ID',
    );
  });

  it('throws when value is boolean', () => {
    expect(() => pipe.transform(true, metadata)).toThrow('Invalid Snowflake ID');
  });

  it('throws when number exceeds MAX_SAFE_INTEGER with message to pass as string', () => {
    expect(() =>
      pipe.transform(Number.MAX_SAFE_INTEGER + 1, metadata),
    ).toThrow(SNOWFLAKE_STRING_MESSAGE);
  });

  it('throws when array first element is unsafe integer', () => {
    expect(() =>
      pipe.transform([Number.MAX_SAFE_INTEGER + 1], metadata),
    ).toThrow(SNOWFLAKE_STRING_MESSAGE);
  });
});
