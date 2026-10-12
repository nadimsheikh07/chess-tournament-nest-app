import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.trim().toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        password: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  async create(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    const user = this.userRepository.create({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
    });

    return this.userRepository.save(user);
  }

  async updateRefreshTokenHash(
    userId: string,
    refreshTokenHash: string | null,
  ): Promise<void> {
    await this.userRepository.update(userId, {
      refreshTokenHash,
    });
  }

  async findByIdWithRefreshToken(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        refreshTokenHash: true,
        role: true,
      },
    });
  }

  /**
   * Get the authenticated user's profile.
   */
  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Update the authenticated user's profile.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.name !== undefined) {
      user.name = dto.name.trim();
    }

    if (dto.email !== undefined) {
      user.email = dto.email.trim().toLowerCase();
    }

    const updatedUser = await this.userRepository.save(user);

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  /**
   * Get matches for the authenticated user.
   * Implement after defining the match entity and relationship.
   */
  async getMyMatches(userId: string) {
    await this.ensureUserExists(userId);

    return {
      message: 'Match listing is not implemented yet',
      data: [],
    };
  }

  /**
   * Get the authenticated user's tournament schedule.
   * Implement after defining tournament registration and schedule entities.
   */
  async getMySchedule(userId: string) {
    await this.ensureUserExists(userId);

    return {
      message: 'Tournament schedule is not implemented yet',
      data: [],
    };
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const exists = await this.userRepository.exists({
      where: { id: userId },
    });

    if (!exists) {
      throw new NotFoundException('User not found');
    }
  }
}
