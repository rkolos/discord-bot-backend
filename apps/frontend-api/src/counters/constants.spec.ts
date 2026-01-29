import { CounterMetric, CounterType } from '@app/shared';
import { DISPLAY_TYPE_TO_API } from './constants';

describe('Counter type mapping', () => {
  it('maps members_all to stat + members', () => {
    expect(DISPLAY_TYPE_TO_API.members_all).toEqual({
      type: CounterType.STAT,
      metric: CounterMetric.MEMBERS,
    });
  });

  it('maps members_online to stat + online', () => {
    expect(DISPLAY_TYPE_TO_API.members_online).toEqual({
      type: CounterType.STAT,
      metric: CounterMetric.ONLINE,
    });
  });

  it('maps members_bots to stat + bots', () => {
    expect(DISPLAY_TYPE_TO_API.members_bots).toEqual({
      type: CounterType.STAT,
      metric: CounterMetric.BOTS,
    });
  });

  it('maps date_now to clock + null metric', () => {
    expect(DISPLAY_TYPE_TO_API.date_now).toEqual({
      type: CounterType.CLOCK,
      metric: null,
    });
  });

  it('uses valid CounterType enum values', () => {
    const types = Object.values(CounterType);
    for (const entry of Object.values(DISPLAY_TYPE_TO_API)) {
      expect(types).toContain(entry.type);
    }
  });

  it('uses valid CounterMetric enum values or null', () => {
    const metrics = Object.values(CounterMetric);
    for (const entry of Object.values(DISPLAY_TYPE_TO_API)) {
      if (entry.metric !== null) {
        expect(metrics).toContain(entry.metric);
      }
    }
  });
});
