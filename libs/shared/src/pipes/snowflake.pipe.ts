import {
  BadRequestException,
  Injectable,
  PipeTransform,
  type ArgumentMetadata,
} from '@nestjs/common';
import { SNOWFLAKE_STRING_MESSAGE } from './is-snowflake.decorator';

/**
 * Преобразует входящее значение (число, строка, массив) в string для Discord Snowflake ID.
 * Числа вне Number.isSafeInteger отклоняются с требованием передавать ID строкой.
 * Невалидный ввод приводит к BadRequestException.
 */
@Injectable()
export class SnowflakePipe implements PipeTransform<unknown, string> {
  transform(value: unknown, _metadata: ArgumentMetadata): string {
    if (value === null || value === undefined) {
      throw new BadRequestException('Snowflake ID is required');
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (!Number.isSafeInteger(value)) {
        throw new BadRequestException(SNOWFLAKE_STRING_MESSAGE);
      }
      return String(value);
    }
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === 'string') return first;
      if (typeof first === 'number' && Number.isFinite(first)) {
        if (!Number.isSafeInteger(first)) {
          throw new BadRequestException(SNOWFLAKE_STRING_MESSAGE);
        }
        return String(first);
      }
      throw new BadRequestException('Invalid Snowflake ID');
    }
    throw new BadRequestException('Invalid Snowflake ID');
  }
}
