import {
  formatCounterChannelName,
  previewCounterTemplate,
} from './counter-template.util';
import { COUNTER_TEMPLATE_MAX_LENGTH } from '../validators/template-with-placeholder.validator';

describe('counter-template.util', () => {
  describe('previewCounterTemplate', () => {
    it('replaces {count} with sample value 1,234', () => {
      const result = previewCounterTemplate('Members: {count}');
      expect(result).toContain('1,234');
      expect(result).toBe('Members: 1,234');
    });

    it('replaces {date} with sample date', () => {
      const result = previewCounterTemplate('Today: {date}');
      expect(result).toMatch(/^Today: /);
      expect(result.length).toBeLessThanOrEqual(COUNTER_TEMPLATE_MAX_LENGTH);
    });

    it('replaces unknown placeholder with sample count', () => {
      const result = previewCounterTemplate('Value: {value}');
      expect(result).toContain('1,234');
    });

    it('truncates result to COUNTER_TEMPLATE_MAX_LENGTH', () => {
      const longPrefix = 'a'.repeat(COUNTER_TEMPLATE_MAX_LENGTH - 5);
      const result = previewCounterTemplate(`${longPrefix}{count}`);
      expect(result.length).toBe(COUNTER_TEMPLATE_MAX_LENGTH);
    });
  });

  describe('formatCounterChannelName', () => {
    it('substitutes numeric count into template', () => {
      const result = formatCounterChannelName('Members: {count}', { count: 1234 });
      expect(result).toBe('Members: 1,234');
    });

    it('formats large numbers with commas', () => {
      const result = formatCounterChannelName('Total: {count}', { count: 1234567 });
      expect(result).toBe('Total: 1,234,567');
    });

    it('substitutes date when provided', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const result = formatCounterChannelName('Date: {date}', { date });
      expect(result).toMatch(/^Date: /);
      expect(result.length).toBeLessThanOrEqual(COUNTER_TEMPLATE_MAX_LENGTH);
    });

    it('uses sample values when count and date are not provided', () => {
      const result = formatCounterChannelName('Members: {count}');
      expect(result).toContain('1,234');
    });

    it('truncates to max length', () => {
      const longPrefix = 'x'.repeat(COUNTER_TEMPLATE_MAX_LENGTH - 2);
      const result = formatCounterChannelName(`${longPrefix}{count}`, { count: 99 });
      expect(result.length).toBe(COUNTER_TEMPLATE_MAX_LENGTH);
    });

    it('handles empty template', () => {
      const result = formatCounterChannelName('', { count: 1 });
      expect(result).toBe('');
    });

    it('handles count 0', () => {
      const result = formatCounterChannelName('Count: {count}', { count: 0 });
      expect(result).toBe('Count: 0');
    });
  });
});
