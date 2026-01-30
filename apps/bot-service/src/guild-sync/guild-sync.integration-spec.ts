import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { join } from 'path';
import { DataSource, Repository } from 'typeorm';
import {
  Guild,
  GuildStatus,
  GuildSubscriptionTier,
  ServerSettings,
  User,
  UserPlan,
  UserStatus,
} from '@app/shared';
import { syncOnReady, syncOnGuildCreate, syncOnGuildDelete } from './guild-sync.updates';

const ENTITIES = [User, Guild, ServerSettings];

describe('GuildSync integration (PostgreSQL)', () => {
  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let ds: DataSource;
  let userRepo: Repository<User>;
  let guildRepo: Repository<Guild>;
  let settingsRepo: Repository<ServerSettings>;

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
      migrations: [
        join(process.cwd(), 'libs/shared/src/database/migrations', '*.{ts,js}'),
      ],
      synchronize: false,
    });
    await ds.initialize();
    await ds.runMigrations();

    userRepo = ds.getRepository(User);
    guildRepo = ds.getRepository(Guild);
    settingsRepo = ds.getRepository(ServerSettings);
  }, 60_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  }, 30_000);

  it('syncOnReady updates server_settings bot_connected, bot_user_id, last_connected', async () => {
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
    const savedGuild = await guildRepo.save(guild);

    const settings = settingsRepo.create({
      guildId: savedGuild.id,
      serverName: 'Test',
      language: 'en',
      timezone: 'UTC',
      botConnected: false,
      botUserId: null,
      lastConnected: null,
      updatedAt: new Date(),
    });
    await settingsRepo.save(settings);

    await syncOnReady(ds.manager, {
      discordGuildId: savedGuild.discordGuildId,
      botUserId: '999888777666555',
      shardId: 0,
      guildIdUuid: savedGuild.id,
      isCustomToken: true,
    });

    const updated = await settingsRepo.findOne({
      where: { guildId: savedGuild.id },
    });
    expect(updated).not.toBeNull();
    expect(updated?.botConnected).toBe(true);
    expect(updated?.botUserId).toBe('999888777666555');
    expect(updated?.lastConnected).toBeInstanceOf(Date);
  });

  it('syncOnGuildCreate updates guild and server_settings when guild exists', async () => {
    const user = userRepo.create({
      username: 'user2',
      plan: UserPlan.FREE,
      status: UserStatus.ACTIVE,
    });
    const savedUser = await userRepo.save(user);

    const guild = guildRepo.create({
      discordGuildId: '222333444555666777',
      name: 'Guild Two',
      ownerId: savedUser.id,
      status: GuildStatus.ACTIVE,
      subscriptionTier: GuildSubscriptionTier.FREE,
      memberCount: 0,
      messageCount: '0',
      isBotInGuild: false,
      shardId: null,
    });
    const savedGuild = await guildRepo.save(guild);

    const settings = settingsRepo.create({
      guildId: savedGuild.id,
      serverName: 'Guild Two',
      language: 'en',
      timezone: 'UTC',
      botConnected: false,
      lastConnected: null,
      updatedAt: new Date(),
    });
    await settingsRepo.save(settings);

    await syncOnGuildCreate(ds.manager, {
      discordGuildId: savedGuild.discordGuildId,
      guildName: 'Guild Two',
      shardId: 1,
    });

    const updatedGuild = await guildRepo.findOne({
      where: { id: savedGuild.id },
    });
    expect(updatedGuild?.isBotInGuild).toBe(true);
    expect(updatedGuild?.shardId).toBe(1);

    const updatedSettings = await settingsRepo.findOne({
      where: { guildId: savedGuild.id },
    });
    expect(updatedSettings?.botConnected).toBe(true);
    expect(updatedSettings?.lastConnected).toBeInstanceOf(Date);
  });

  it('syncOnGuildDelete sets status inactive and is_bot_in_guild false', async () => {
    const user = userRepo.create({
      username: 'user3',
      plan: UserPlan.FREE,
      status: UserStatus.ACTIVE,
    });
    const savedUser = await userRepo.save(user);

    const guild = guildRepo.create({
      discordGuildId: '333444555666777888',
      name: 'Guild Three',
      ownerId: savedUser.id,
      status: GuildStatus.ACTIVE,
      subscriptionTier: GuildSubscriptionTier.FREE,
      memberCount: 0,
      messageCount: '0',
      isBotInGuild: true,
    });
    const savedGuild = await guildRepo.save(guild);

    await syncOnGuildDelete(ds.manager, {
      discordGuildId: savedGuild.discordGuildId,
    });

    const updated = await guildRepo.findOne({
      where: { id: savedGuild.id },
    });
    expect(updated?.status).toBe(GuildStatus.INACTIVE);
    expect(updated?.isBotInGuild).toBe(false);
  });
});
