import { COUNTER_TEMPLATE_MAX_LENGTH } from '../validators/template-with-placeholder.validator';

export interface FormatCounterTemplateOptions {
  /** Значение для плейсхолдера {count} и прочих {name}. Если не задано, используется sample. */
  count?: number | null;
  /** Дата для плейсхолдера {date}. Если не задано, используется текущая дата. */
  date?: Date | null;
  /** Часовой пояс для форматирования даты (например 'Europe/Moscow'). */
  timezone?: string | null;
  /** Стиль даты: 'short' | 'long' и т.д. или кастомный формат. */
  dateFormat?: string | null;
}

const SAMPLE_COUNT = '1,234';

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatDate(date: Date, timezone?: string | null, dateFormat?: string | null): string {
  const opts: Intl.DateTimeFormatOptions =
    dateFormat === 'short' || !dateFormat
      ? { year: 'numeric', month: 'short', day: 'numeric' }
      : { dateStyle: 'long' };
  if (timezone) {
    return date.toLocaleDateString('en-US', { ...opts, timeZone: timezone });
  }
  return date.toLocaleDateString('en-US', opts);
}

/**
 * Подставляет в шаблон значения count и date, обрезает результат до COUNTER_TEMPLATE_MAX_LENGTH.
 * Плейсхолдеры: {count}, {date}, любые {name} (заменяются на count или sample).
 */
export function formatCounterChannelName(
  template: string,
  options: FormatCounterTemplateOptions = {},
): string {
  const countVal = options.count;
  const dateVal = options.date ?? new Date();
  const countStr =
    countVal != null ? formatNumber(countVal) : SAMPLE_COUNT;
  const dateStr = formatDate(
    dateVal instanceof Date ? dateVal : new Date(dateVal),
    options.timezone,
    options.dateFormat,
  );
  let result = template
    .replace(/\{count\}/gi, countStr)
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{[a-zA-Z0-9_]+\}/g, countStr);
  if (result.length > COUNTER_TEMPLATE_MAX_LENGTH) {
    result = result.slice(0, COUNTER_TEMPLATE_MAX_LENGTH);
  }
  return result;
}

/**
 * Превью шаблона с примерными значениями (1,234 и текущая дата).
 * Результат обрезается до COUNTER_TEMPLATE_MAX_LENGTH.
 */
export function previewCounterTemplate(template: string): string {
  return formatCounterChannelName(template, {});
}
