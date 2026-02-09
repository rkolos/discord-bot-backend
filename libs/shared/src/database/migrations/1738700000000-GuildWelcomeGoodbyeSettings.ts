import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuildWelcomeGoodbyeSettings1738700000000 implements MigrationInterface {
  name = 'GuildWelcomeGoodbyeSettings1738700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "guild_welcome_goodbye_settings" (
        "guild_id" uuid NOT NULL,
        "type" text NOT NULL,
        "channel_id" text,
        "enabled" boolean NOT NULL DEFAULT true,
        "message_type" text NOT NULL DEFAULT 'text',
        "content_text" text,
        "content_embed" jsonb,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guild_welcome_goodbye_settings" PRIMARY KEY ("guild_id", "type"),
        CONSTRAINT "FK_guild_welcome_goodbye_settings_guild" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_guild_welcome_goodbye_type" CHECK ("type" IN ('welcome', 'goodbye')),
        CONSTRAINT "CHK_guild_welcome_goodbye_message_type" CHECK ("message_type" IN ('text', 'embed', 'text_and_embed'))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "guild_welcome_goodbye_settings"`);
  }
}
