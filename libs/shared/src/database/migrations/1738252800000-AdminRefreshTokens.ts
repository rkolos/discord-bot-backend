import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminRefreshTokens1738252800000 implements MigrationInterface {
  name = 'AdminRefreshTokens1738252800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "admin_user_id" uuid NOT NULL,
        "token_hash" text NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_admin_refresh_tokens_admin_user" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_admin_refresh_tokens_token_hash" ON "admin_refresh_tokens" ("token_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_admin_refresh_tokens_admin_user_id" ON "admin_refresh_tokens" ("admin_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_admin_refresh_tokens_admin_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_admin_refresh_tokens_token_hash"`);
    await queryRunner.query(`DROP TABLE "admin_refresh_tokens"`);
  }
}
