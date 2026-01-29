import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { join } from 'path';
import { DataSource } from 'typeorm';
import {
  ActivityLog,
  AdminRefreshToken,
  AdminUser,
  Company,
  CompanyInvite,
  CompanyMember,
  Counter,
  Guild,
  GuildModule,
  Invoice,
  PlanLimits,
  RefreshToken,
  ServerSettings,
  SubscriptionPlan,
  UsageLimits,
  User,
  UserSubscription,
  Widget,
} from './entities';

const ENTITIES = [
  ActivityLog,
  AdminRefreshToken,
  AdminUser,
  Company,
  CompanyInvite,
  CompanyMember,
  Counter,
  Guild,
  GuildModule,
  Invoice,
  PlanLimits,
  RefreshToken,
  ServerSettings,
  SubscriptionPlan,
  UsageLimits,
  User,
  UserSubscription,
  Widget,
];

describe('PostgreSQL integration', () => {
  let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
  let ds: DataSource;

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
      migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
      synchronize: false,
    });
    await ds.initialize();
    await ds.runMigrations();
  }, 60_000);

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
    if (container) await container.stop();
  }, 30_000);

  it('connects and runs migrations successfully', async () => {
    const r = await ds.query('SELECT 1 AS n');
    expect(r).toHaveLength(1);
    expect((r[0] as { n: number }).n).toBe(1);
  });

  it('has users table from migrations', async () => {
    const r = await ds.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'`,
    );
    expect(r).toHaveLength(1);
    expect((r[0] as { table_name: string }).table_name).toBe('users');
  });
});
