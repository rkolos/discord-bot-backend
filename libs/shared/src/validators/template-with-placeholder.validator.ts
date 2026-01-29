import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/** Максимальная длина имени канала в Discord. */
export const COUNTER_TEMPLATE_MAX_LENGTH = 100;

/** Регулярное выражение для плейсхолдеров вида {name}. */
const PLACEHOLDER_REGEX = /\{[a-zA-Z0-9_]+\}/;

/**
 * Проверяет, что строка содержит хотя бы один плейсхолдер (например {count}, {date})
 * и не превышает COUNTER_TEMPLATE_MAX_LENGTH символов.
 */
export function IsCounterTemplate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isCounterTemplate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments): boolean {
          if (typeof value !== 'string') {
            return false;
          }
          if (value.length > COUNTER_TEMPLATE_MAX_LENGTH) {
            return false;
          }
          return PLACEHOLDER_REGEX.test(value);
        },
        defaultMessage(args: ValidationArguments): string {
          const value = args.value;
          if (typeof value !== 'string') {
            return `${args.property} must be a string`;
          }
          if (value.length > COUNTER_TEMPLATE_MAX_LENGTH) {
            return `${args.property} must be at most ${COUNTER_TEMPLATE_MAX_LENGTH} characters`;
          }
          return `${args.property} must contain at least one placeholder (e.g. {count}, {date})`;
        },
      },
    });
  };
}
