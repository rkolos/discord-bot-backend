import {
  registerDecorator,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
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

function RoleIdEmptyWhenMetricNotRole(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'roleIdEmptyWhenMetricNotRole',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const o = args.object as { metric?: CounterMetric | null; roleId?: string | null };
          if (o.metric !== CounterMetric.ROLE) {
            return value == null || value === '';
          }
          return true;
        },
        defaultMessage(): string {
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

  @IsOptional()
  @ValidateIf((o: CreateCounterDto) => o.metric === CounterMetric.ROLE)
  @IsNotEmpty({ message: 'roleId is required when metric is role' })
  @Snowflake()
  @ValidateIf((o: CreateCounterDto) => o.metric !== CounterMetric.ROLE)
  @RoleIdEmptyWhenMetricNotRole()
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
