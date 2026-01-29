import { Test, TestingModule } from '@nestjs/testing';
import { SharedConfigService } from '@app/shared';
import { LogsQueueService } from './logs-queue.service';

const mockQueueAdd = jest.fn().mockResolvedValue({ id: '1' });
jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('LogsQueueService', () => {
  let service: LogsQueueService;

  beforeEach(async () => {
    mockQueueAdd.mockClear();
    const mockSharedConfig = {
      redis: {
        host: 'localhost',
        port: 6379,
        password: undefined,
        prefix: 'sn:test:',
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsQueueService,
        { provide: SharedConfigService, useValue: mockSharedConfig },
      ],
    }).compile();

    service = module.get(LogsQueueService);
  });

  it('addLogsConfigUpdate passes guild_id and discord_guild_id in payload', async () => {
    await service.addLogsConfigUpdate({
      guild_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      discord_guild_id: '111222333444555666',
    });
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'config-update',
      {
        guild_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        discord_guild_id: '111222333444555666',
      },
      { priority: 0 },
    );
  });
});
