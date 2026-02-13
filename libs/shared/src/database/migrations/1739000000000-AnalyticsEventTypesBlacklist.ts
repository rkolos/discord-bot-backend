import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnalyticsEventTypesBlacklist1739000000000 implements MigrationInterface {
  name = 'AnalyticsEventTypesBlacklist1739000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "server_settings"
      ADD COLUMN "analytics_event_types_blacklist" jsonb DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "server_settings"
      DROP COLUMN "analytics_event_types_blacklist"
    `);
  }
}
