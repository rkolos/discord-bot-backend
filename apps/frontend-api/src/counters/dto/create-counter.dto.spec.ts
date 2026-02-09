import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCounterDto } from './create-counter.dto';
import { CounterMetric, CounterType } from '@app/shared';

describe('CreateCounterDto', () => {
  it('passes when metric is role and roleId is provided', async () => {
    const dto = plainToInstance(CreateCounterDto, {
      channelId: '987654321098765432',
      type: CounterType.STAT,
      metric: CounterMetric.ROLE,
      roleId: '111222333444555777',
      template: 'Admins: {count}',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when metric is role and roleId is missing', async () => {
    const dto = plainToInstance(CreateCounterDto, {
      channelId: '987654321098765432',
      type: CounterType.STAT,
      metric: CounterMetric.ROLE,
      template: 'Admins: {count}',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const roleIdError = errors.find((e) => e.property === 'roleId');
    expect(roleIdError).toBeDefined();
  });

  it('fails when metric is not role and roleId is provided', async () => {
    const dto = plainToInstance(CreateCounterDto, {
      channelId: '987654321098765432',
      type: CounterType.STAT,
      metric: CounterMetric.MEMBERS,
      roleId: '111222333444555777',
      template: 'Members: {count}',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const roleIdError = errors.find((e) => e.property === 'roleId');
    expect(roleIdError).toBeDefined();
    expect(roleIdError?.constraints?.roleIdEmptyWhenMetricNotRole).toContain('roleId must be empty');
  });
});
