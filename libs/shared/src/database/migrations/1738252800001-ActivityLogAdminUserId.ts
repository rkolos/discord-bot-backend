import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActivityLogAdminUserId1738252800001 implements MigrationInterface {
  name = 'ActivityLogAdminUserId1738252800001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "activity_log"
      ADD COLUMN "admin_user_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "activity_log"
      ADD CONSTRAINT "FK_activity_log_admin_user" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_activity_log_admin_user_id" ON "activity_log" ("admin_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_activity_log_admin_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "activity_log" DROP CONSTRAINT "FK_activity_log_admin_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "activity_log" DROP COLUMN "admin_user_id"`,
    );
  }
}
