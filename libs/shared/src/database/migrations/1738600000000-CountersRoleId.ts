import { MigrationInterface, QueryRunner } from 'typeorm';

export class CountersRoleId1738600000000 implements MigrationInterface {
  name = 'CountersRoleId1738600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "counters"
      ADD COLUMN "role_id" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "counters"
      DROP COLUMN "role_id"
    `);
  }
}
