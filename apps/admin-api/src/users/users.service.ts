import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  User,
  UserStatus,
  Guild,
  ActivityLog,
  Invoice,
  SharedConfigService,
} from '@app/shared';

const IMPERSONATION_TTL_SECONDS = 3600;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly jwtService: JwtService,
    private readonly sharedConfig: SharedConfigService,
  ) {}

  async getUsers(
    page: number,
    limit: number,
    search?: string,
    status?: string,
    plan?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ): Promise<{
    data: Array<{
      id: string;
      discordId: string | null;
      username: string;
      discriminator: string | null;
      avatarUrl: string | null;
      email: string | null;
      plan: string;
      status: string;
      createdAt: string;
      lastLoginAt: string | null;
      ownedGuildsCount: number;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const qb = this.userRepository.createQueryBuilder('u');
    if (search && search.trim()) {
      qb.andWhere(
        '(u.username ILIKE :search OR u.email ILIKE :search OR u.discord_id::text ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }
    if (status && status !== 'all') {
      qb.andWhere('u.status = :status', { status });
    }
    if (plan && plan !== 'all') {
      qb.andWhere('u.plan = :plan', { plan });
    }
    const orderBy =
      sortBy === 'username'
        ? 'u.username'
        : sortBy === 'lastLoginAt'
          ? 'u.last_login_at'
          : 'u.created_at';
    qb.orderBy(orderBy, sortOrder === 'asc' ? 'ASC' : 'DESC');
    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    const take = Math.min(100, Math.max(1, limit));
    const [raw, total] = await qb.skip(skip).take(take).getManyAndCount();
    const guildCounts = await Promise.all(
      raw.map((u) => this.guildRepository.count({ where: { ownerId: u.id } })),
    );
    const data = raw.map((u, i) => ({
      id: u.id,
      discordId: u.discordId,
      username: u.username,
      discriminator: u.discriminator,
      avatarUrl: u.avatarUrl,
      email: u.email,
      plan: u.plan,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      ownedGuildsCount: guildCounts[i] ?? 0,
    }));
    const totalPages = Math.ceil(total / take) || 1;
    return {
      data,
      meta: { total, page: Math.max(1, page), limit: take, totalPages },
    };
  }

  async getUserById(userId: string): Promise<{
    id: string;
    discordId: string | null;
    username: string;
    discriminator: string | null;
    avatarUrl: string | null;
    email: string | null;
    plan: string;
    status: string;
    createdAt: string;
    lastLoginAt: string | null;
    ownedGuildsCount: number;
    activityLog: Array<{ id: string; action: string; timestamp: string; details: string | null }>;
    balance?: number;
    ownedGuilds: Array<{
      id: string;
      discordGuildId: string;
      name: string;
      iconUrl: string | null;
      ownerId: string;
      memberCount: number;
      shardId: number | null;
      isBotInGuild: boolean;
      activeCountersCount: number;
      widgetsCreatedCount: number;
      joinedAt: string;
    }>;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User with id '${userId}' not found`,
      });
    }
    const [ownedGuilds, activityLog, ownedGuildsCount] = await Promise.all([
      this.guildRepository.find({
        where: { ownerId: userId },
        order: { createdAt: 'DESC' },
      }),
      this.activityLogRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.guildRepository.count({ where: { ownerId: userId } }),
    ]);
    const ownedGuildsWithCounts = await Promise.all(
      ownedGuilds.map(async (g) => ({
        id: g.id,
        discordGuildId: g.discordGuildId,
        name: g.name,
        iconUrl: g.iconUrl,
        ownerId: g.ownerId,
        memberCount: g.memberCount,
        shardId: g.shardId,
        isBotInGuild: g.isBotInGuild,
        activeCountersCount: 0,
        widgetsCreatedCount: 0,
        joinedAt: g.createdAt.toISOString(),
      })),
    );
    return {
      id: user.id,
      discordId: user.discordId,
      username: user.username,
      discriminator: user.discriminator,
      avatarUrl: user.avatarUrl,
      email: user.email,
      plan: user.plan,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      ownedGuildsCount,
      activityLog: activityLog.map((a) => ({
        id: a.id,
        action: a.action,
        timestamp: a.createdAt.toISOString(),
        details: a.details,
      })),
      ownedGuilds: ownedGuildsWithCounts,
    };
  }

  async banUser(userId: string, _reason?: string): Promise<{ success: true }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    if (user.status === UserStatus.BANNED) {
      throw new BadRequestException({
        code: 'USER_ALREADY_BANNED',
        message: 'User already banned',
      });
    }
    user.status = UserStatus.BANNED;
    await this.userRepository.save(user);
    return { success: true };
  }

  async unbanUser(userId: string): Promise<{ success: true }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    if (user.status !== UserStatus.BANNED) {
      throw new BadRequestException({
        code: 'USER_NOT_BANNED',
        message: 'User is not banned',
      });
    }
    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);
    return { success: true };
  }

  async impersonate(userId: string): Promise<{ token: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    const jwtSecret = this.sharedConfig.auth.jwtSecret;
    const token = this.jwtService.sign(
      { sub: user.id, impersonation: true },
      { secret: jwtSecret, expiresIn: IMPERSONATION_TTL_SECONDS },
    );
    return { token };
  }

  async getBilling(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      currency: string;
      status: string;
      description: string;
      createdAt: string;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    const skip = (Math.max(1, page) - 1) * Math.min(50, Math.max(1, limit));
    const take = Math.min(50, Math.max(1, limit));
    const [invoices, total] = await this.invoiceRepository.findAndCount({
      where: { userId },
      order: { date: 'DESC' },
      skip,
      take,
    });
    const transactions = invoices.map((i) => ({
      id: i.id,
      type: 'subscription' as const,
      amount: Number(i.amount),
      currency: i.currency,
      status: i.status,
      description: `Invoice ${i.id}`,
      createdAt: i.date.toISOString(),
    }));
    const totalPages = Math.ceil(total / take) || 1;
    return {
      transactions,
      meta: { total, page: Math.max(1, page), limit: take, totalPages },
    };
  }
}
