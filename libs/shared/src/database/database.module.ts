import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedConfigModule } from '../config/shared-config.module';
import { SharedConfigService } from '../config/shared-config.service';
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
  GuildWelcomeGoodbyeSetting,
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
  GuildLogSetting,
  GuildWelcomeGoodbyeSetting,
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

@Module({
  imports: [
    SharedConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [SharedConfigModule],
      useFactory: (
        sharedConfig: SharedConfigService,
        configService: ConfigService,
      ) => {
        const db = sharedConfig.db;
        const nodeEnv = configService.get<string>('NODE_ENV');
        const runMigrations =
          nodeEnv === 'stage' || nodeEnv === 'production';
        const ssl =
          db.host && db.host.includes('ondigitalocean.com')
            ? { rejectUnauthorized: false }
            : false;
        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          username: db.user,
          password: db.password,
          database: db.database,
          ssl,
          entities: ENTITIES,
          synchronize: false,
          logging: ['error'],
          migrationsRun: runMigrations,
          migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
        };
      },
      inject: [SharedConfigService, ConfigService],
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
