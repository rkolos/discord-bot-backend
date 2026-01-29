import { config } from 'dotenv';
import { resolve } from 'path';
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
  GuildLogSetting,
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

config({ path: resolve(process.cwd(), '.env') });

const postgresHost =
  process.env['POSTGRES_HOST'] ?? process.env['DB_HOST'] ?? 'localhost';
const postgresPort = process.env['POSTGRES_PORT'] ?? process.env['DB_PORT'] ?? '5432';

/**
 * DataSource для TypeORM CLI (migration:generate, migration:run, migration:revert).
 * Используются POSTGRES_* или fallback DB_HOST/DB_PORT из .env.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: postgresHost,
  port: parseInt(postgresPort, 10),
  username: process.env['POSTGRES_USER'] ?? '',
  password: process.env['POSTGRES_PASSWORD'] ?? '',
  database: process.env['POSTGRES_DB'] ?? '',
  entities: [
    ActivityLog,
    AdminRefreshToken,
    AdminUser,
    Company,
    CompanyInvite,
    CompanyMember,
    Counter,
    Guild,
    GuildLogSetting,
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
  ],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
