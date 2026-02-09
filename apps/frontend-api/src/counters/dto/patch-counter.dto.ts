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
  CounterStatus,
  CounterType,
  COUNTER_TEMPLATE_MAX_LENGTH,
  IsCounterTemplate,
  Snowflake,
} from '@app/shared';

function RoleIdEmptyWhenMetricNotRolePatch(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'roleIdEmptyWhenMetricNotRolePatch',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const o = args.object as { metric?: CounterMetric | null; roleId?: string | null };
          if (o.metric !== undefined && o.metric !== CounterMetric.ROLE) {
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

export class PatchCounterDto {
  @IsOptional()
  @Snowflake()
  channelId?: string;

  @IsOptional()
  @IsEnum(CounterType)
  type?: CounterType;

  @IsOptional()
  @IsEnum(CounterMetric)
  metric?: CounterMetric | null;

  @IsOptional()
  @ValidateIf((o: PatchCounterDto) => o.metric === CounterMetric.ROLE)
  @IsNotEmpty({ message: 'roleId is required when metric is role' })
  @Snowflake()
  @ValidateIf((o: PatchCounterDto) => o.metric !== undefined && o.metric !== CounterMetric.ROLE)
  @RoleIdEmptyWhenMetricNotRolePatch()
  roleId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(COUNTER_TEMPLATE_MAX_LENGTH)
  @IsCounterTemplate()
  template?: string;

  @IsOptional()
  @IsEnum(CounterStatus)
  status?: CounterStatus;

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
