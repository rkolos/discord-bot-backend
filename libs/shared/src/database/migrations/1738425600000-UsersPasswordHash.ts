import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsersPasswordHash1738425600000 implements MigrationInterface {
  name = 'UsersPasswordHash1738425600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "password_hash" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "password_hash"
    `);
  }
}
