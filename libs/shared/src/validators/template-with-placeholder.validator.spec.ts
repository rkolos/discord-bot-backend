import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  COUNTER_TEMPLATE_MAX_LENGTH,
  IsCounterTemplate,
} from './template-with-placeholder.validator';

class DtoWithTemplate {
  @IsCounterTemplate()
  template!: string;
}

describe('IsCounterTemplate', () => {
  it('accepts template with {count} placeholder', async () => {
    const plain = { template: 'Members: {count}' };
    const instance = plainToInstance(DtoWithTemplate, plain);
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
  });

  it('accepts template with {date} placeholder', async () => {
    const plain = { template: 'Today: {date}' };
    const instance = plainToInstance(DtoWithTemplate, plain);
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
  });

  it('accepts template with custom placeholder {value}', async () => {
    const plain = { template: 'Value: {value}' };
    const instance = plainToInstance(DtoWithTemplate, plain);
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
  });

  it('rejects template without placeholder', async () => {
    const plain = { template: 'No placeholder here' };
    const instance = plainToInstance(DtoWithTemplate, plain);
    const errors = await validate(instance);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('template');
    expect(errors[0].constraints?.isCounterTemplate).toContain('placeholder');
  });

  it('rejects template longer than 100 characters', async () => {
    const longPrefix = 'a'.repeat(COUNTER_TEMPLATE_MAX_LENGTH - 5);
    const plain = { template: `${longPrefix}{count}` };
    const instance = plainToInstance(DtoWithTemplate, plain);
    const errors = await validate(instance);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isCounterTemplate).toContain(
      String(COUNTER_TEMPLATE_MAX_LENGTH),
    );
  });

  it('accepts template with exactly 100 characters including placeholder', async () => {
    const prefix = 'a'.repeat(COUNTER_TEMPLATE_MAX_LENGTH - 7);
    const plain = { template: `${prefix}{count}` };
    const instance = plainToInstance(DtoWithTemplate, plain);
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
  });

  it('rejects non-string value', async () => {
    const plain = { template: 123 };
    const instance = plainToInstance(DtoWithTemplate, plain);
    const errors = await validate(instance);
    expect(errors).toHaveLength(1);
  });
});
