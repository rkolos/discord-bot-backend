import { Test, TestingModule } from '@nestjs/testing';
import { ClickHouseService, SharedConfigService } from '@app/shared';
import { ClickHouseIngestorService } from './clickhouse-ingestor.service';
import type { RawEvent } from './ingestor.types';

describe('ClickHouse Ingestor performance (buffer batching)', () => {
  let ingestor: ClickHouseIngestorService;
  let insertSpy: jest.SpyInstance;

  const baseEvent: RawEvent = {
    eventId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    eventTime: '2025-01-15T12:00:00.000Z',
    eventType: 'MESSAGE_CREATE',
    guildId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    discordGuildId: '111222333444555678',
    discordUserId: '222333444555666789',
    channelId: '333444555666777890',
    planTier: 'free',
    isBotGenerated: false,
    payload: '{}',
  };

  beforeEach(async () => {
    const mockClickhouse = {
      insert: jest.fn().mockResolvedValue({ query_id: 'q1', executed: true }),
    };
    const mockConfig = {
      clickhouse: { database: 'default' },
      ingestor: { batchSize: 1000, batchIntervalMs: 5000 },
      auth: { anonymizationSalt: 'test-salt' },
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ClickHouseIngestorService,
        { provide: ClickHouseService, useValue: mockClickhouse },
        { provide: SharedConfigService, useValue: mockConfig },
      ],
    }).compile();

    ingestor = mod.get(ClickHouseIngestorService);
    insertSpy = jest.spyOn(mod.get(ClickHouseService), 'insert');

    (ingestor as unknown as { onModuleInit: () => void }).onModuleInit();
  });

  afterEach(async () => {
    await (
      ingestor as unknown as { onModuleDestroy: () => Promise<void> }
    ).onModuleDestroy();
    insertSpy.mockRestore();
  });

  it('2000 events produce exactly 2 INSERT calls of 1000 rows each', async () => {
    for (let i = 0; i < 2000; i++) {
      ingestor.pushEvent({
        ...baseEvent,
        eventId: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a${String(i).padStart(2, '0')}`,
      });
    }
    await ingestor.flush();

    expect(insertSpy).toHaveBeenCalledTimes(2);
    type InsertArg = { table: string; format: string; values: unknown[] };
    const [firstArg0, secondArg0] = insertSpy.mock.calls.map(
      (c) => (c as [InsertArg])[0],
    );
    expect(firstArg0.table).toBe('default.raw_events');
    expect(firstArg0.format).toBe('JSONEachRow');
    expect(Array.isArray(firstArg0.values)).toBe(true);
    expect(firstArg0.values.length).toBe(1000);
    expect(secondArg0.table).toBe('default.raw_events');
    expect(secondArg0.format).toBe('JSONEachRow');
    expect(Array.isArray(secondArg0.values)).toBe(true);
    expect(secondArg0.values.length).toBe(1000);
  });
});
