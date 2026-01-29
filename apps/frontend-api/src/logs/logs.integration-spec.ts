import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Guild,
  GuildLogSetting,
  GuildStatus,
  GuildSubscriptionTier,
  User,
  UserPlan,
  UserStatus,
} from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';
import { LogsQueueService } from './logs-queue.service';
import { LogsService } from './logs.service';
import { PatchLogSettingsDto } from './dto';

const ENTITIES = [Guild, GuildLogSetting, User];

describe('Logs integration (PostgreSQL)', () => {
  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let ds: DataSource;
  let userRepo: Repository<User>;
  let guildRepo: Repository<Guild>;
  let logSettingsRepo: Repository<GuildLogSetting>;
  let logsService: LogsService;
  let mockQueueService: jest.Mocked<Pick<LogsQueueService, 'addLogsConfigUpdate'>>;
  let savedGuild: Guild;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();

    ds = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: ENTITIES,
      migrations: [join(process.cwd(), 'libs/shared/src/database/migrations', '*.{ts,js}')],
      synchronize: false,
    });
    await ds.initialize();
    await ds.runMigrations();

    userRepo = ds.getRepository(User);
    guildRepo = ds.getRepository(Guild);
    logSettingsRepo = ds.getRepository(GuildLogSetting);

    const user = userRepo.create({
      username: 'testuser',
      plan: UserPlan.FREE,
      status: UserStatus.ACTIVE,
    });
    const savedUser = await userRepo.save(user);

    const guild = guildRepo.create({
      discordGuildId: '123456789012345678',
      name: 'Test Guild',
      ownerId: savedUser.id,
      status: GuildStatus.ACTIVE,
      subscriptionTier: GuildSubscriptionTier.FREE,
      memberCount: 0,
      messageCount: '0',
      isBotInGuild: false,
    });
    savedGuild = await guildRepo.save(guild);

    mockQueueService = {
      addLogsConfigUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const mockGuildsService = {
      findGuildByDiscordId: jest.fn().mockResolvedValue(savedGuild),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        { provide: getRepositoryToken(GuildLogSetting), useValue: logSettingsRepo },
        { provide: GuildsService, useValue: mockGuildsService },
        { provide: LogsQueueService, useValue: mockQueueService },
      ],
    }).compile();

    logsService = module.get(LogsService);
  }, 60_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  }, 30_000);

  it('writes guild_log_settings and calls addLogsConfigUpdate on PATCH', async () => {
    const dto: PatchLogSettingsDto = {
      settings: [
        { eventType: 'member_join', channelId: '987654321098765432', enabled: true },
        { eventType: 'message_delete', channelId: '987654321098765432', enabled: false },
      ],
    };

    await logsService.patchSettings(savedGuild.discordGuildId, dto);

    const rows = await logSettingsRepo.find({
      where: { guildId: savedGuild.id },
    });
    expect(rows).toHaveLength(2);
    const memberJoin = rows.find((r) => r.eventType === 'member_join');
    const messageDelete = rows.find((r) => r.eventType === 'message_delete');
    expect(memberJoin?.channelId).toBe('987654321098765432');
    expect(memberJoin?.enabled).toBe(true);
    expect(messageDelete?.channelId).toBe('987654321098765432');
    expect(messageDelete?.enabled).toBe(false);

    expect(mockQueueService.addLogsConfigUpdate).toHaveBeenCalledWith({
      guild_id: savedGuild.id,
      discord_guild_id: savedGuild.discordGuildId,
    });
  });
});
