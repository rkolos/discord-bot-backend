import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser, SharedConfigService } from '@app/shared';

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
    const admin = await this.adminUserRepository.findOne({
      where: { id: payload.sub },
    });
    if (!admin) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
    }
    return admin;
  }
}
