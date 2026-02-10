import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyInviteLinkFlow1738900000000 implements MigrationInterface {
  name = 'CompanyInviteLinkFlow1738900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_invites"
      ALTER COLUMN "email" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "company_invites"
      ADD COLUMN "invitee_display_name" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "company_invites"
      DROP COLUMN "invitee_display_name"
    `);
    await queryRunner.query(`
      ALTER TABLE "company_invites"
      ALTER COLUMN "email" SET NOT NULL
    `);
  }
}
