import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import {
  AdminUser,
  AdminRefreshToken,
  ActivityLog,
  SharedConfigService,
} from '@app/shared';
import { PasswordService } from './password.service';

const JWT_ACCESS_TTL_SECONDS = 900; // 15 min
const REFRESH_TOKEN_TTL_DAYS = 7;
const ACTION_LOGIN_SUCCESS = 'admin_login_success';
const ACTION_LOGIN_FAILURE = 'admin_login_failure';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    @InjectRepository(AdminRefreshToken)
    private readonly adminRefreshTokenRepository: Repository<AdminRefreshToken>,
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
    private readonly jwtService: JwtService,
    private readonly sharedConfig: SharedConfigService,
    private readonly passwordService: PasswordService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    user: AdminUser;
  }> {
    const admin = await this.adminUserRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (!admin) {
      await this.logLoginFailure(null, email);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    const valid = await this.passwordService.compare(password, admin.passwordHash);
    if (!valid) {
      await this.logLoginFailure(admin.id, email);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    const now = new Date();
    admin.lastLoginAt = now;
    await this.adminUserRepository.save(admin);
    await this.logLoginSuccess(admin.id);
    const { accessToken, refreshToken, expiresAt } =
      await this.createSession(admin);
    return { accessToken, refreshToken, expiresAt, user: admin };
  }

  async createSession(admin: AdminUser): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const secret = this.sharedConfig.auth.adminJwtSecret;
    if (!secret) {
      throw new Error('ADMIN_JWT_SECRET is not set');
    }
    const accessToken = this.jwtService.sign(
      { sub: admin.id, aud: 'admin-api' },
      { secret, expiresIn: JWT_ACCESS_TTL_SECONDS },
    );
    const refreshToken = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
    await this.adminRefreshTokenRepository.save(
      this.adminRefreshTokenRepository.create({
        adminUserId: admin.id,
        tokenHash,
        expiresAt,
      }),
    );
    return { accessToken, refreshToken, expiresAt };
  }

  async refresh(refreshTokenValue: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const tokenHash = createHash('sha256')
      .update(refreshTokenValue)
      .digest('hex');
    const record = await this.adminRefreshTokenRepository.findOne({
      where: { tokenHash },
    });
    if (!record) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired refresh token',
      });
    }
    if (record.revokedAt) {
      await this.revokeAllRefreshTokensForAdmin(record.adminUserId);
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Refresh token reuse detected',
      });
    }
    const now = new Date();
    if (record.expiresAt <= now) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired refresh token',
      });
    }
    const admin = await this.adminUserRepository.findOne({
      where: { id: record.adminUserId },
    });
    if (!admin) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired refresh token',
      });
    }
    record.revokedAt = now;
    await this.adminRefreshTokenRepository.save(record);
    return this.createSession(admin);
  }

  async logout(
    adminUserId: string,
    refreshTokenValue: string | undefined,
  ): Promise<void> {
    if (!refreshTokenValue) {
      return;
    }
    const tokenHash = createHash('sha256')
      .update(refreshTokenValue)
      .digest('hex');
    const record = await this.adminRefreshTokenRepository.findOne({
      where: { tokenHash, adminUserId: adminUserId },
    });
    if (record && !record.revokedAt) {
      record.revokedAt = new Date();
      await this.adminRefreshTokenRepository.save(record);
    }
  }

  private async logLoginSuccess(adminUserId: string): Promise<void> {
    await this.activityLogRepository.save(
      this.activityLogRepository.create({
        userId: null,
        adminUserId,
        action: ACTION_LOGIN_SUCCESS,
        details: null,
      }),
    );
  }

  private async logLoginFailure(
    adminUserId: string | null,
    email: string,
  ): Promise<void> {
    const masked =
      email.length <= 2
        ? '***'
        : email.slice(0, 2) + '***' + email.slice(-1);
    await this.activityLogRepository.save(
      this.activityLogRepository.create({
        userId: null,
        adminUserId,
        action: ACTION_LOGIN_FAILURE,
        details: JSON.stringify({ emailMasked: masked }),
      }),
    );
  }

  private async revokeAllRefreshTokensForAdmin(adminUserId: string): Promise<void> {
    const now = new Date();
    await this.adminRefreshTokenRepository.update(
      { adminUserId },
      { revokedAt: now },
    );
  }
}
