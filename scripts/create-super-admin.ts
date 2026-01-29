/**
 * Скрипт создания первого SuperAdmin.
 * Запуск: npm run create-super-admin (из корня проекта).
 * Требует в .env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, POSTGRES_*.
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../libs/shared/src/database/data-source';
import { AdminUser, AdminUserRole } from '../libs/shared/src/database/entities/admin-user.entity';

const SALT_ROUNDS = 10;

async function main(): Promise<void> {
  config({ path: resolve(process.cwd(), '.env') });

  const email = process.env['ADMIN_EMAIL'];
  const password = process.env['ADMIN_PASSWORD'];
  const name = process.env['ADMIN_NAME'];

  if (!email || !password || !name) {
    console.error(
      'Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME in .env before running this script.',
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  await AppDataSource.initialize();
  try {
    const repo = AppDataSource.getRepository(AdminUser);
    const existing = await repo.findOne({ where: { email } });
    if (existing) {
      console.error(`Admin with email ${email} already exists.`);
      process.exit(1);
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const admin = repo.create({
      email,
      name,
      role: AdminUserRole.SUPER_ADMIN,
      passwordHash,
    });
    await repo.save(admin);
    console.log(`SuperAdmin created: ${email}`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
