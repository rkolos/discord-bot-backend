import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnonymizeUserDataDefaultFalse1738800000000 implements MigrationInterface {
  name = 'AnonymizeUserDataDefaultFalse1738800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "server_settings"
      SET "anonymize_user_data" = false
    `);
    await queryRunner.query(`
      ALTER TABLE "server_settings"
      ALTER COLUMN "anonymize_user_data" SET DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "server_settings"
      ALTER COLUMN "anonymize_user_data" SET DEFAULT true
    `);
  }
}
