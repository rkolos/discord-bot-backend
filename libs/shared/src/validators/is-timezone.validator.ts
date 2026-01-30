import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * Проверяет, что значение — допустимый IANA timezone (например Europe/Moscow, UTC).
 * Использует Intl.DateTimeFormat; при невалидной timezone выбрасывается RangeError.
 */
function isValidTimezone(value: string): boolean {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Валидирует поле как IANA timezone (для заголовков и query-параметров аналитики).
 */
export function IsTimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isTimezone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments): boolean {
          if (value === undefined || value === null) {
            return true;
          }
          if (typeof value !== 'string') {
            return false;
          }
          return isValidTimezone(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a valid IANA timezone (e.g. Europe/Moscow, UTC)`;
        },
      },
    });
  };
}
