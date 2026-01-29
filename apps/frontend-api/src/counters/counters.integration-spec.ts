import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { join } from 'path';
import { DataSource, Repository } from 'typeorm';
import {
  Counter,
  CounterMetric,
  CounterStatus,
  CounterType,
  Guild,
  GuildStatus,
  GuildSubscriptionTier,
  User,
  UserPlan,
  UserStatus,
} from '@app/shared';

const ENTITIES = [Counter, Guild, User];

describe('Counters integration (PostgreSQL)', () => {
  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let ds: DataSource;
  let userRepo: Repository<User>;
  let guildRepo: Repository<Guild>;
  let counterRepo: Repository<Counter>;

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
    counterRepo = ds.getRepository(Counter);
  }, 60_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  }, 30_000);

  it('creates counter record and links to guild', async () => {
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

    const counter = counterRepo.create({
      guildId: savedGuild.id,
      channelId: '987654321098765432',
      channelName: 'Members: 1,234',
      type: CounterType.STAT,
      metric: CounterMetric.MEMBERS,
      template: 'Members: {count}',
      status: CounterStatus.ACTIVE,
      updatedAt: new Date(),
    });
    const savedCounter = await counterRepo.save(counter) as Counter;

    expect(savedCounter.id).toBeDefined();
    expect(savedCounter.guildId).toBe(savedGuild.id);
    expect(savedCounter.channelId).toBe('987654321098765432');
    expect(savedCounter.template).toBe('Members: {count}');

    const found = await counterRepo.findOne({
      where: { id: savedCounter.id },
      relations: ['guild'],
    });
    expect(found).not.toBeNull();
    expect(found?.guild?.id).toBe(savedGuild.id);
    expect(found?.guild?.discordGuildId).toBe('123456789012345678');
  });
});
