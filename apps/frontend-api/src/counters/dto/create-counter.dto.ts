import {
  registerDecorator,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import {
  CounterMetric,
  CounterType,
  COUNTER_TEMPLATE_MAX_LENGTH,
  IsCounterTemplate,
  Snowflake,
} from '@app/shared';

const SNOWFLAKE_REGEX = /^\d{17,19}$/;

function RoleIdForCreateCounter(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'roleIdForCreateCounter',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const o = args.object as { metric?: CounterMetric | null; roleId?: string | null };
          if (o.metric === CounterMetric.ROLE) {
            if (value == null || value === '') return false;
            return typeof value === 'string' && SNOWFLAKE_REGEX.test(value);
          }
          return value == null || value === '';
        },
        defaultMessage(args: ValidationArguments): string {
          const o = args.object as { metric?: CounterMetric | null };
          if (o.metric === CounterMetric.ROLE) {
            return 'roleId is required when metric is role';
          }
          return 'roleId must be empty when metric is not role';
        },
      },
    });
  };
}

export class CreateCounterDto {
  @Snowflake()
  channelId: string;

  @IsEnum(CounterType)
  type: CounterType;

  @IsOptional()
  @IsEnum(CounterMetric)
  metric?: CounterMetric | null;

  @RoleIdForCreateCounter()
  roleId?: string | null;

  @IsString()
  @MaxLength(COUNTER_TEMPLATE_MAX_LENGTH)
  @IsCounterTemplate()
  template: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  target?: number;

  @IsOptional()
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @IsString()
  dateFormat?: string | null;
}
