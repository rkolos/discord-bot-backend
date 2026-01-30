import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@app/shared';

@Injectable()
export class MeService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getMe(userId: string): Promise<{
    id: string;
    name: string;
    email: string | null;
    avatar: string | null;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new HttpException(
        { error: { code: 'UNAUTHORIZED', message: 'User not found' } },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return {
      id: user.id,
      name: user.username,
      email: user.email,
      avatar: user.avatarUrl,
    };
  }

  async updateMe(
    userId: string,
    dto: { name?: string; email?: string; avatar?: string },
  ): Promise<{
    id: string;
    name: string;
    email: string | null;
    avatar: string | null;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new HttpException(
        { error: { code: 'UNAUTHORIZED', message: 'User not found' } },
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (dto.name !== undefined) user.username = dto.name.trim();
    if (dto.email !== undefined) {
      const normalized = dto.email.toLowerCase().trim();
      const existing = await this.userRepository.findOne({
        where: { email: normalized },
      });
      if (existing && existing.id !== userId) {
        throw new HttpException(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: { email: 'Email already exists' },
            },
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      user.email = normalized;
    }
    if (dto.avatar !== undefined) user.avatarUrl = dto.avatar;
    await this.userRepository.save(user);
    return {
      id: user.id,
      name: user.username,
      email: user.email,
      avatar: user.avatarUrl,
    };
  }
}
