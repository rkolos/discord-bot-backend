import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1738166400000 implements MigrationInterface {
  name = 'InitialSchema1738166400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "discord_id" text,
        "username" text NOT NULL,
        "discriminator" text,
        "avatar_url" text,
        "email" text,
        "plan" text NOT NULL,
        "status" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_users_discord_id" UNIQUE ("discord_id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "admin_users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "name" text NOT NULL,
        "avatar_url" text,
        "role" text NOT NULL,
        "password_hash" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_admin_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_admin_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "subscription_plans" (
        "id" text NOT NULL,
        "name" text NOT NULL,
        "price" decimal(10,2) NOT NULL,
        "price_period" text NOT NULL,
        CONSTRAINT "PK_subscription_plans" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" text NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "owner_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_companies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_companies_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "company_members" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" text NOT NULL,
        "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_company_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_company_members_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_company_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "company_invites" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "email" text NOT NULL,
        "role" text NOT NULL,
        "invite_token" text NOT NULL,
        "invited_by" uuid NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_company_invites_invite_token" UNIQUE ("invite_token"),
        CONSTRAINT "PK_company_invites" PRIMARY KEY ("id"),
        CONSTRAINT "FK_company_invites_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_company_invites_invited_by" FOREIGN KEY ("invited_by") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "guilds" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "discord_guild_id" text NOT NULL,
        "name" text NOT NULL,
        "icon_url" text,
        "banner" text,
        "owner_id" uuid NOT NULL,
        "status" text NOT NULL,
        "subscription_tier" text NOT NULL,
        "member_count" integer NOT NULL DEFAULT 0,
        "message_count" bigint NOT NULL DEFAULT 0,
        "online_members" integer,
        "member_growth" integer,
        "last_activity" TIMESTAMP WITH TIME ZONE,
        "shard_id" integer,
        "is_bot_in_guild" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "history_sync_status" text NOT NULL DEFAULT 'PENDING',
        CONSTRAINT "UQ_guilds_discord_guild_id" UNIQUE ("discord_guild_id"),
        CONSTRAINT "PK_guilds" PRIMARY KEY ("id"),
        CONSTRAINT "FK_guilds_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "guild_modules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "guild_id" uuid NOT NULL,
        "module_key" text NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "has_error" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_guild_modules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_guild_modules_guild" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "server_settings" (
        "guild_id" uuid NOT NULL,
        "server_name" text NOT NULL,
        "server_description" text,
        "language" text NOT NULL,
        "timezone" text NOT NULL DEFAULT 'UTC',
        "bot_token_encrypted" text,
        "bot_connected" boolean NOT NULL DEFAULT false,
        "bot_user_id" text,
        "last_connected" TIMESTAMP WITH TIME ZONE,
        "last_sync_at" TIMESTAMP WITH TIME ZONE,
        "data_retention_days" integer NOT NULL DEFAULT 0,
        "anonymize_user_data" boolean NOT NULL DEFAULT true,
        "share_analytics" boolean NOT NULL DEFAULT true,
        "allow_public_widgets" boolean NOT NULL DEFAULT true,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_server_settings" PRIMARY KEY ("guild_id"),
        CONSTRAINT "FK_server_settings_guild" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "counters" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "guild_id" uuid NOT NULL,
        "channel_id" text NOT NULL,
        "channel_name" text NOT NULL,
        "type" text NOT NULL,
        "metric" text,
        "template" text NOT NULL,
        "status" text NOT NULL,
        "current_value" bigint,
        "target" bigint,
        "timezone" text,
        "date_format" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_counters" PRIMARY KEY ("id"),
        CONSTRAINT "FK_counters_guild" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "widgets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "guild_id" uuid NOT NULL,
        "name" text NOT NULL,
        "config" jsonb NOT NULL,
        "embed_url" text NOT NULL,
        "embed_code" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_widgets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_widgets_guild" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "plan_limits" (
        "plan_id" text NOT NULL,
        "servers_limit" integer NOT NULL,
        "members_limit" integer NOT NULL,
        "messages_limit" integer NOT NULL,
        CONSTRAINT "PK_plan_limits" PRIMARY KEY ("plan_id"),
        CONSTRAINT "FK_plan_limits_plan" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "user_subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "plan_id" text NOT NULL,
        "status" text NOT NULL,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "canceled_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_user_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_subscriptions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
        CONSTRAINT "FK_user_subscriptions_plan" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "amount" decimal(10,2) NOT NULL,
        "currency" text NOT NULL,
        "date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" text NOT NULL,
        "download_url" text,
        CONSTRAINT "PK_invoices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invoices_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "usage_limits" (
        "user_id" uuid NOT NULL,
        "servers_limit" integer NOT NULL DEFAULT 0,
        "members_limit" integer NOT NULL DEFAULT 0,
        "messages_limit" integer NOT NULL DEFAULT 0,
        "servers_used" integer NOT NULL DEFAULT 0,
        "members_used" integer NOT NULL DEFAULT 0,
        "messages_used" integer NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_usage_limits" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_usage_limits_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "activity_log" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "action" text NOT NULL,
        "details" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_log" PRIMARY KEY ("id"),
        CONSTRAINT "FK_activity_log_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "activity_log"`);
    await queryRunner.query(`DROP TABLE "usage_limits"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TABLE "user_subscriptions"`);
    await queryRunner.query(`DROP TABLE "plan_limits"`);
    await queryRunner.query(`DROP TABLE "widgets"`);
    await queryRunner.query(`DROP TABLE "counters"`);
    await queryRunner.query(`DROP TABLE "server_settings"`);
    await queryRunner.query(`DROP TABLE "guild_modules"`);
    await queryRunner.query(`DROP TABLE "guilds"`);
    await queryRunner.query(`DROP TABLE "company_invites"`);
    await queryRunner.query(`DROP TABLE "company_members"`);
    await queryRunner.query(`DROP TABLE "companies"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "subscription_plans"`);
    await queryRunner.query(`DROP TABLE "admin_users"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
