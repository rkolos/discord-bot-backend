import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser, RedisService, SharedConfigService } from '@app/shared';

const ADMIN_USER_CACHE_TTL_SEC = 300; // 5 min
const CACHE_KEY_PREFIX = 'admin-api:auth:admin-user:';

export interface AdminJwtPayload {
  sub: string;
  aud?: string;
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    sharedConfig: SharedConfigService,
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    private readonly redis: RedisService,
  ) {
    const secret = sharedConfig.auth.adminJwtSecret;
    if (!secret) {
      throw new Error('ADMIN_JWT_SECRET is required for admin-api');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      algorithms: ['HS256'],
      audience: 'admin-api',
    });
  }

  async validate(payload: AdminJwtPayload): Promise<AdminUser> {
    const cacheKey = CACHE_KEY_PREFIX + payload.sub;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as Record<string, unknown>;
      return this.hydrateAdminUser(parsed);
    }

    const admin = await this.adminUserRepository.findOne({
      where: { id: payload.sub },
    });
    if (!admin) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
    }

    await this.redis.set(
      cacheKey,
      JSON.stringify({
        id: admin.id,
        email: admin.email,
        name: admin.name,
        avatarUrl: admin.avatarUrl,
        role: admin.role,
        passwordHash: admin.passwordHash,
        createdAt: admin.createdAt?.toISOString?.(),
        lastLoginAt: admin.lastLoginAt?.toISOString?.(),
      }),
      ADMIN_USER_CACHE_TTL_SEC,
    );

    return admin;
  }

  private hydrateAdminUser(parsed: Record<string, unknown>): AdminUser {
    const admin = new AdminUser();
    admin.id = parsed.id as string;
    admin.email = parsed.email as string;
    admin.name = parsed.name as string;
    admin.avatarUrl = parsed.avatarUrl as string | null;
    admin.role = parsed.role as AdminUser['role'];
    admin.passwordHash = parsed.passwordHash as string;
    admin.createdAt = parsed.createdAt
      ? new Date(parsed.createdAt as string)
      : (undefined as unknown as Date);
    admin.lastLoginAt = parsed.lastLoginAt
      ? new Date(parsed.lastLoginAt as string)
      : null;
    return admin;
  }
}
