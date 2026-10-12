import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { AppModule } from '../app.module';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from '../users/entities/user.entity';

const demoUsers = [
  {
    name: 'Kingdom Coach',
    email: 'coach@kingdom.local',
    password: 'CoachChess123!',
    role: UserRole.COACH,
  },
  ...Array.from({ length: 4 }, (_, index) => ({
    name: `Chess Student ${index + 1}`,
    email: `student${index + 1}@kingdom.local`,
    password: 'StudentChess123!',
    role: UserRole.PLAYER,
  })),
];

async function seedDemoUsers(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const users = app.get<Repository<User>>(getRepositoryToken(User));
    for (const fixture of demoUsers) {
      const user = await users.findOneBy({ email: fixture.email });
      const password = await bcrypt.hash(fixture.password, 12);
      const seed = {
        name: fixture.name,
        email: fixture.email,
        password,
        role: fixture.role,
        rating: 1200,
        refreshTokenHash: null,
      };

      if (user) {
        Object.assign(user, seed);
        await users.save(user);
      } else {
        await users.save(users.create(seed));
      }
      console.log(`Seeded ${fixture.role}: ${fixture.email}`);
    }
  } finally {
    await app.close();
  }
}

seedDemoUsers().catch((error: unknown) => {
  console.error(
    'Failed to seed demo users:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
