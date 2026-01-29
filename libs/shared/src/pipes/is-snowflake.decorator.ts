import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** Discord Snowflake ID: 17–19 decimal digits. */
const SNOWFLAKE_REGEX = /^\d{17,19}$/;

export const SNOWFLAKE_STRING_MESSAGE =
  'Pass Snowflake ID as string to avoid precision loss';

/**
 * Трансформирует безопасное целое число в строку.
 * Числа вне Number.isSafeInteger остаются как есть и будут отклонены валидатором @IsSnowflake().
 */
export function TransformToSnowflakeString(
  target: object,
  propertyKey: string,
): void {
  Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'number' && Number.isSafeInteger(value)) {
      return String(value);
    }
    return value;
  })(target, propertyKey);
}

/**
 * Валидирует значение как Discord Snowflake ID (строка из 17–19 цифр).
 * Числа отклоняются с требованием передавать ID строкой (из-за потери точности вне Number.MAX_SAFE_INTEGER).
 */
export function IsSnowflake(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isSnowflake',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments): boolean {
          if (typeof value === 'number') {
            return false;
          }
          if (typeof value !== 'string') {
            return false;
          }
          return SNOWFLAKE_REGEX.test(value);
        },
        defaultMessage(args: ValidationArguments): string {
          const value = args.value;
          if (typeof value === 'number') {
            return SNOWFLAKE_STRING_MESSAGE;
          }
          return `${args.property} must be a valid Snowflake ID (17–19 digits)`;
        },
      },
    });
  };
}

/**
 * Составной декоратор для полей Snowflake в DTO: трансформация безопасного числа в строку + валидация формата.
 * Использовать на полях guildId, userId, channelId, messageId и т.п.
 */
export function Snowflake(validationOptions?: ValidationOptions) {
  return function (target: object, propertyKey: string): void {
    TransformToSnowflakeString(target, propertyKey);
    IsSnowflake(validationOptions)(target, propertyKey);
  };
}
