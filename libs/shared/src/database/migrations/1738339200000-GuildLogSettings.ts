import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuildLogSettings1738339200000 implements MigrationInterface {
  name = 'GuildLogSettings1738339200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "guild_log_settings" (
        "guild_id" uuid NOT NULL,
        "event_type" text NOT NULL,
        "channel_id" text,
        "enabled" boolean NOT NULL DEFAULT true,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guild_log_settings" PRIMARY KEY ("guild_id", "event_type"),
        CONSTRAINT "FK_guild_log_settings_guild" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "guild_log_settings"`);
  }
}
