import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { randomBytes } from 'node:crypto';
import { SharedConfigService } from '@app/shared';
import { RedisService } from '@app/shared';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const OAUTH_AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize';
const SCOPES = ['identify', 'email', 'guilds'];
const BOT_INSTALL_SCOPES = ['bot', 'applications.commands', 'identify'];
const STATE_REDIS_KEY_PREFIX = 'frontend-api:auth:discord:state:';
const DISCORD_TOKEN_REDIS_KEY_PREFIX = 'frontend-api:auth:discord-token:';
const STATE_TTL_SECONDS = 600;

export interface DiscordStateData {
  redirectUri: string | null;
  isBotInstall?: boolean;
}

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface DiscordUserResponse {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string | null;
  global_name?: string | null;
}

@Injectable()
export class DiscordOAuthService {
  constructor(
    private readonly sharedConfig: SharedConfigService,
    private readonly redis: RedisService,
    private readonly httpService: HttpService,
  ) {}

  async buildLoginUrl(frontendRedirectUri?: string): Promise<{ state: string; url: string }> {
    const { clientId, oauthRedirectUri, frontendBaseUrl } =
      this.sharedConfig.discord;
    if (frontendRedirectUri != null && frontendBaseUrl != null) {
      try {
        const parsed = new URL(frontendRedirectUri);
        const allowedBase = new URL(frontendBaseUrl);
        const expectedPath = '/login/callback';
        const normalizedPath = parsed.pathname.replace(/\/$/, '') || '/';
        if (
          parsed.origin !== allowedBase.origin ||
          normalizedPath !== expectedPath
        ) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'redirect_uri must be {FRONTEND_BASE_URL}/login/callback',
            details: { redirect_uri: 'Invalid redirect_uri' },
          });
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'redirect_uri must be a valid URL',
          details: { redirect_uri: 'Invalid redirect_uri' },
        });
      }
    }
    const state = randomBytes(32).toString('hex');
    const key = STATE_REDIS_KEY_PREFIX + state;
    const stateData: DiscordStateData = { redirectUri: frontendRedirectUri ?? null };
    await this.redis.set(key, JSON.stringify(stateData), STATE_TTL_SECONDS);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: oauthRedirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      state,
    });
    const url = `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
    return { state, url };
  }

  async buildBotInstallUrl(
    frontendRedirectUri?: string,
    permissions = '8',
  ): Promise<{ state: string; url: string }> {
    const { clientId, oauthRedirectUri, frontendBaseUrl } =
      this.sharedConfig.discord;
    if (frontendRedirectUri != null && frontendBaseUrl != null) {
      try {
        const parsed = new URL(frontendRedirectUri);
        const allowedBase = new URL(frontendBaseUrl);
        const expectedPath = '/add-bot/callback';
        const normalizedPath = parsed.pathname.replace(/\/$/, '') || '/';
        if (
          parsed.origin !== allowedBase.origin ||
          normalizedPath !== expectedPath
        ) {
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message:
              'redirect_uri must be {FRONTEND_BASE_URL}/add-bot/callback',
            details: { redirect_uri: 'Invalid redirect_uri' },
          });
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'redirect_uri must be a valid URL',
          details: { redirect_uri: 'Invalid redirect_uri' },
        });
      }
    }
    const state = randomBytes(32).toString('hex');
    const key = STATE_REDIS_KEY_PREFIX + state;
    const stateData: DiscordStateData = {
      redirectUri: frontendRedirectUri ?? null,
      isBotInstall: true,
    };
    await this.redis.set(key, JSON.stringify(stateData), STATE_TTL_SECONDS);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: oauthRedirectUri,
      response_type: 'code',
      scope: BOT_INSTALL_SCOPES.join(' '),
      permissions,
      state,
    });
    const url = `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
    return { state, url };
  }

  async getStateDataAndConsume(state: string): Promise<DiscordStateData | null> {
    const key = STATE_REDIS_KEY_PREFIX + state;
    const stored = await this.redis.get(key);
    await this.redis.del(key);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as DiscordStateData;
    } catch {
      return null;
    }
  }

  async validateState(state: string): Promise<boolean> {
    const key = STATE_REDIS_KEY_PREFIX + state;
    const stored = await this.redis.get(key);
    if (!stored) return false;
    await this.redis.del(key);
    return true;
  }

  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
  ): Promise<DiscordTokenResponse> {
    const { clientId, clientSecret } = this.sharedConfig.discord;
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    try {
      const response = await firstValueFrom(
        this.httpService.post<DiscordTokenResponse>(
          `${DISCORD_API_BASE}/oauth2/token`,
          body.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );
      return response.data;
    } catch {
      throw new HttpException(
        {
          code: 'OAUTH_FAILED',
          message: 'Discord OAuth authentication failed',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async getDiscordUser(accessToken: string): Promise<DiscordUserResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<DiscordUserResponse>(
          `${DISCORD_API_BASE}/users/@me`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      );
      return response.data;
    } catch {
      throw new HttpException(
        {
          code: 'OAUTH_FAILED',
          message: 'Discord OAuth authentication failed',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async storeDiscordToken(
    userId: string,
    accessToken: string,
    expiresInSeconds: number,
  ): Promise<void> {
    const key = DISCORD_TOKEN_REDIS_KEY_PREFIX + userId;
    await this.redis.set(key, accessToken, expiresInSeconds);
  }

  async getDiscordToken(userId: string): Promise<string | null> {
    const key = DISCORD_TOKEN_REDIS_KEY_PREFIX + userId;
    return this.redis.get(key);
  }

  async deleteDiscordToken(userId: string): Promise<void> {
    const key = DISCORD_TOKEN_REDIS_KEY_PREFIX + userId;
    await this.redis.del(key);
  }
}
