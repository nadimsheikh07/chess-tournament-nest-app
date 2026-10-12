import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { AppModule } from '../app.module';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from '../users/entities/user.entity';

async function createSuperAdmin(): Promise<void> {
  const name = process.env.SUPER_ADMIN_NAME?.trim();
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      'Set SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, and SUPER_ADMIN_PASSWORD before running this command.',
    );
  }
  if (name.length > 100 || email.length > 255) {
    throw new Error('Name must be at most 100 characters and email at most 255.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const users = app.get<Repository<User>>(getRepositoryToken(User));
    const existingUser = await users.findOne({ where: { email } });
    if (existingUser) {
      throw new Error(`A user with email "${email}" already exists.`);
    }

    const user = users.create({
      name,
      email,
      password: await bcrypt.hash(password, 12),
      role: UserRole.ADMIN,
      rating: 1200,
    });
    await users.save(user);

    console.log(`Super admin created: ${email}`);
  } finally {
    await app.close();
  }
}

createSuperAdmin().catch((error: unknown) => {
  console.error(
    'Failed to create super admin:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
