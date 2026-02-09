import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Counter, CounterStatus, CounterType, CounterMetric } from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';
import { CountersQueueService } from './counters-queue.service';
import { CountersService } from './counters.service';

describe('CountersService', () => {
  let service: CountersService;
  let counterRepo: jest.Mocked<Repository<Counter>>;
  let guildsService: jest.Mocked<Pick<GuildsService, 'findGuildByIdOrDiscordId'>>;
  let queueService: jest.Mocked<Pick<CountersQueueService, 'addCounterUpdate' | 'addCounterDelete'>>;

  const guildId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const discordGuildId = '111222333444555666';
  const mockGuild = { id: guildId, discordGuildId } as { id: string; discordGuildId: string };

  const createCounter = (overrides: Partial<Counter> = {}): Counter =>
    ({
      id: 'counter-uuid',
      guildId,
      channelId: '987654321098765432',
      channelName: 'Members: 1,234',
      type: CounterType.STAT,
      metric: CounterMetric.MEMBERS,
      roleId: null,
      template: 'Members: {count}',
      status: CounterStatus.ACTIVE,
      currentValue: null,
      target: null,
      timezone: null,
      dateFormat: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Counter;

  beforeEach(async () => {
    const mockCounterRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    const mockGuildsService = {
      findGuildByIdOrDiscordId: jest.fn(),
    };
    const mockQueueService = {
      addCounterUpdate: jest.fn().mockResolvedValue(undefined),
      addCounterDelete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountersService,
        { provide: getRepositoryToken(Counter), useValue: mockCounterRepo },
        { provide: GuildsService, useValue: mockGuildsService },
        { provide: CountersQueueService, useValue: mockQueueService },
      ],
    }).compile();

    service = module.get(CountersService);
    counterRepo = module.get(getRepositoryToken(Counter));
    guildsService = module.get(GuildsService);
    queueService = module.get(CountersQueueService);
  });

  describe('create', () => {
    it('creates counter and enqueues update', async () => {
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(mockGuild as never);
      const created = createCounter();
      (counterRepo.create as jest.Mock).mockReturnValue(created);
      (counterRepo.save as jest.Mock).mockResolvedValue(created);

      const dto = {
        channelId: '987654321098765432',
        type: CounterType.STAT,
        metric: CounterMetric.MEMBERS,
        template: 'Members: {count}',
      };

      const result = await service.create(discordGuildId, dto);

      expect(result.id).toBe(created.id);
      expect(result.channelId).toBe(dto.channelId);
      expect(result.template).toBe(dto.template);
      expect(guildsService.findGuildByIdOrDiscordId).toHaveBeenCalledWith(discordGuildId);
      expect(queueService.addCounterUpdate).toHaveBeenCalledWith(created);
    });

    it('throws GUILD_NOT_FOUND when guild does not exist', async () => {
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(null as never);

      const err = await service
        .create(discordGuildId, {
          channelId: '987654321098765432',
          type: CounterType.STAT,
          metric: CounterMetric.MEMBERS,
          template: 'Members: {count}',
        })
        .catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toMatchObject({
        code: 'GUILD_NOT_FOUND',
      });
    });
  });

  describe('findAllByGuild', () => {
    it('returns counters for guild', async () => {
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(mockGuild as never);
      const list = [createCounter()];
      (counterRepo.find as jest.Mock).mockResolvedValue(list);

      const result = await service.findAllByGuild(discordGuildId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(list[0].id);
      expect(guildsService.findGuildByIdOrDiscordId).toHaveBeenCalledWith(discordGuildId);
    });

    it('throws GUILD_NOT_FOUND when guild does not exist', async () => {
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(null as never);

      await expect(service.findAllByGuild(discordGuildId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates counter and enqueues update', async () => {
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(mockGuild as never);
      const existing = createCounter();
      (counterRepo.findOne as jest.Mock).mockResolvedValue(existing);
      (counterRepo.save as jest.Mock).mockResolvedValue({ ...existing, template: 'Updated: {count}' });

      const result = await service.update(discordGuildId, existing.id, {
        template: 'Updated: {count}',
      });

      expect(result.template).toBe('Updated: {count}');
      expect(queueService.addCounterUpdate).toHaveBeenCalled();
    });

    it('throws COUNTER_NOT_FOUND when counter does not exist', async () => {
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(mockGuild as never);
      (counterRepo.findOne as jest.Mock).mockResolvedValue(null);

      const err = await service
        .update(discordGuildId, 'missing-id', { template: 'X: {count}' })
        .catch((e) => e);
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).getResponse()).toMatchObject({
        code: 'COUNTER_NOT_FOUND',
      });
    });
  });

  describe('remove', () => {
    it('removes counter and enqueues delete', async () => {
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(mockGuild as never);
      const existing = createCounter();
      (counterRepo.findOne as jest.Mock).mockResolvedValue(existing);
      (counterRepo.remove as jest.Mock).mockResolvedValue(undefined);

      const result = await service.remove(discordGuildId, existing.id);

      expect(result).toEqual({ success: true });
      expect(queueService.addCounterDelete).toHaveBeenCalledWith(
        existing.id,
        existing.guildId,
        existing.channelId,
      );
      expect(counterRepo.remove).toHaveBeenCalledWith(existing);
    });

    it('throws COUNTER_NOT_FOUND when counter does not exist', async () => {
      guildsService.findGuildByIdOrDiscordId!.mockResolvedValue(mockGuild as never);
      (counterRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.remove(discordGuildId, 'missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('previewTemplate', () => {
    it('replaces {count} with sample value', () => {
      const result = service.previewTemplate('Members: {count}');
      expect(result).toContain('1,234');
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('replaces {date} with sample date', () => {
      const result = service.previewTemplate('Today: {date}');
      expect(result).toMatch(/Today:/);
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });
});
