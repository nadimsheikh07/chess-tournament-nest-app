import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { Match } from '../matches/entities/match.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FindUsersDto } from './dto/find-users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
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
      role: UserRole.PLAYER,
      rating: 1200,
    });

    return this.userRepository.save(user);
  }

  async adminCreate(actorId: string, dto: CreateUserDto) {
    await this.assertAdmin(actorId);
    const password = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      password,
      role: dto.role ?? UserRole.PLAYER,
      rating: 1200,
    });

    try {
      return this.toPublicUser(await this.userRepository.save(user));
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async adminFindAll(actorId: string, query: FindUsersDto) {
    await this.assertAdmin(actorId);

    const sortColumns = {
      name: 'user.name',
      email: 'user.email',
      role: 'user.role',
      rating: 'user.rating',
      createdAt: 'user.createdAt',
      updatedAt: 'user.updatedAt',
    } as const;
    const sortColumn =
      sortColumns[query.sortBy as keyof typeof sortColumns] ??
      sortColumns.createdAt;
    const sortOrder = query.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.role',
        'user.rating',
        'user.createdAt',
        'user.updatedAt',
      ]);

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      queryBuilder.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR user.role ILIKE :search)',
        { search },
      );
    }

    queryBuilder
      .orderBy(sortColumn, sortOrder)
      .addOrderBy('user.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: query.page * query.limit < total,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  async adminFindOne(actorId: string, userId: string) {
    await this.assertAdmin(actorId);
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublicUser(user);
  }

  async adminUpdate(actorId: string, userId: string, dto: UpdateUserDto) {
    await this.assertAdmin(actorId);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.name !== undefined) {
      user.name = dto.name.trim();
    }
    if (dto.email !== undefined) {
      user.email = dto.email.trim().toLowerCase();
    }
    if (dto.role !== undefined) {
      if (user.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
        const adminCount = await this.userRepository.countBy({
          role: UserRole.ADMIN,
        });
        if (adminCount <= 1) {
          throw new ForbiddenException('Cannot demote the last admin account');
        }
      }
      user.role = dto.role;
    }
    if (dto.password !== undefined) {
      user.password = await bcrypt.hash(dto.password, 12);
    }

    try {
      return this.toPublicUser(await this.userRepository.save(user));
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async adminDelete(actorId: string, userId: string) {
    await this.assertAdmin(actorId);
    if (actorId === userId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      const adminCount = await this.userRepository.countBy({
        role: UserRole.ADMIN,
      });
      if (adminCount <= 1) {
        throw new ForbiddenException('Cannot delete the last admin account');
      }
    }

    await this.userRepository.remove(user);
    return { deleted: true, id: userId };
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
      role: user.role,
      rating: user.rating,
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
      role: updatedUser.role,
      rating: updatedUser.rating,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  async getMyMatches(userId: string) {
    await this.ensureUserExists(userId);

    return this.matchRepository.find({
      where: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
      order: { createdAt: 'DESC' },
    });
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

  private async assertAdmin(actorId: string): Promise<void> {
    const actor = await this.userRepository.findOne({
      where: { id: actorId },
      select: { id: true, role: true },
    });
    if (!actor) {
      throw new NotFoundException('User not found');
    }
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin role required');
    }
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      rating: user.rating,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
