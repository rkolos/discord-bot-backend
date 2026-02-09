import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/** Discord Snowflake ID: 17–19 decimal digits. */
const SNOWFLAKE_REGEX = /^\d{17,19}$/;
/** UUID v1–v5 (например guild.id в БД). */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Валидирует значение как идентификатор гильдии в path: либо Discord Snowflake (discord_guild_id),
 * либо внутренний UUID (guild.id). Позволяет фронту использовать как snowflake из списка гильдий,
 * так и UUID из ответа onboard.
 */
export function IsGuildId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isGuildId',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments): boolean {
          if (typeof value !== 'string') {
            return false;
          }
          return SNOWFLAKE_REGEX.test(value) || UUID_REGEX.test(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a Discord Snowflake (17–19 digits) or a valid UUID`;
        },
      },
    });
  };
}
