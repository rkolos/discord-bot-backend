import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'node:crypto';
import {
  type DiscordUserResponse,
  DiscordOAuthService,
} from './discord-oauth.service';
import {
  User,
  UserPlan,
  UserStatus,
  RefreshToken,
} from '@app/shared';
import { SharedConfigService } from '@app/shared';
import { PasswordService } from './password.service';

const JWT_ACCESS_TTL_SECONDS = 900; // 15 min
const REFRESH_TOKEN_TTL_DAYS = 7;

function buildAvatarUrl(discordId: string, avatarHash: string | null): string | null {
  if (!avatarHash) return null;
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly sharedConfig: SharedConfigService,
    private readonly passwordService: PasswordService,
    private readonly discordOAuth: DiscordOAuthService,
  ) {}

  async register(
    fullName: string,
    email: string,
    password: string,
  ): Promise<{ user: User; accessToken: string; refreshToken: string; expiresAt: Date }> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
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
    const passwordHash = await this.passwordService.hash(password);
    const user = this.userRepository.create({
      username: fullName.trim(),
      email: normalizedEmail,
      passwordHash,
      plan: UserPlan.FREE,
      status: UserStatus.ACTIVE,
    });
    await this.userRepository.save(user);
    const session = await this.createSession(user);
    return { user, ...session };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ user: User; accessToken: string; refreshToken: string; expiresAt: Date }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    const valid = await this.passwordService.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }
    const now = new Date();
    user.lastLoginAt = now;
    await this.userRepository.save(user);
    const session = await this.createSession(user);
    return { user, ...session };
  }

  async verifyDiscordToken(
    discordAccessToken: string,
  ): Promise<{ user: User; accessToken: string; refreshToken: string; expiresAt: Date }> {
    const discordUser = await this.discordOAuth.getDiscordUser(discordAccessToken);
    const user = await this.upsertUserFromDiscord(discordUser);
    return this.createSession(user).then((session) => ({ user, ...session }));
  }

  async upsertUserFromDiscord(
    discordUser: DiscordUserResponse,
  ): Promise<User> {
    const discordId = discordUser.id;
    const existing = await this.userRepository.findOne({
      where: { discordId },
    });
    const avatarUrl = buildAvatarUrl(discordUser.id, discordUser.avatar);
    const now = new Date();
    if (existing) {
      existing.username = discordUser.username;
      existing.email = discordUser.email ?? existing.email;
      existing.avatarUrl = avatarUrl ?? existing.avatarUrl;
      existing.discriminator = discordUser.discriminator ?? existing.discriminator;
      existing.lastLoginAt = now;
      await this.userRepository.save(existing);
      return existing;
    }
    const user = this.userRepository.create({
      discordId,
      username: discordUser.username,
      discriminator: discordUser.discriminator ?? null,
      avatarUrl,
      email: discordUser.email ?? null,
      plan: UserPlan.FREE,
      status: UserStatus.ACTIVE,
      lastLoginAt: now,
    });
    await this.userRepository.save(user);
    return user;
  }

  async createSession(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const jwtSecret = this.sharedConfig.auth.jwtSecret;
    const accessToken = this.jwtService.sign(
      { sub: user.id },
      { secret: jwtSecret, expiresIn: JWT_ACCESS_TTL_SECONDS },
    );
    const refreshToken = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        userId: user.id,
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
    const record = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });
    if (!record) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (record.revokedAt) {
      await this.revokeAllRefreshTokensForUser(record.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    const now = new Date();
    if (record.expiresAt <= now) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = await this.userRepository.findOne({
      where: { id: record.userId },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    record.revokedAt = now;
    await this.refreshTokenRepository.save(record);
    return this.createSession(user);
  }

  async logout(userId: string, refreshTokenValue: string | undefined): Promise<void> {
    if (!refreshTokenValue) {
      return;
    }
    const tokenHash = createHash('sha256')
      .update(refreshTokenValue)
      .digest('hex');
    const record = await this.refreshTokenRepository.findOne({
      where: { tokenHash, userId: userId },
    });
    if (record && !record.revokedAt) {
      record.revokedAt = new Date();
      await this.refreshTokenRepository.save(record);
    }
  }

  private async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    const now = new Date();
    await this.refreshTokenRepository.update(
      { userId },
      { revokedAt: now },
    );
  }
}
