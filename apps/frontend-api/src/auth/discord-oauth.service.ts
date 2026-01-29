import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { randomBytes } from 'node:crypto';
import { SharedConfigService } from '@app/shared';
import { RedisService } from '@app/shared';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const OAUTH_AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize';
const SCOPES = ['identify', 'email', 'guilds'];
const STATE_REDIS_KEY_PREFIX = 'frontend-api:auth:discord:state:';
const DISCORD_TOKEN_REDIS_KEY_PREFIX = 'frontend-api:auth:discord-token:';
const STATE_TTL_SECONDS = 600;

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

  async buildLoginUrl(redirectUri?: string): Promise<{ state: string; url: string }> {
    const { clientId, oauthRedirectUri } = this.sharedConfig.discord;
    const redirect = redirectUri ?? oauthRedirectUri;
    const state = randomBytes(32).toString('hex');
    const key = STATE_REDIS_KEY_PREFIX + state;
    await this.redis.set(key, state, STATE_TTL_SECONDS);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: 'code',
      scope: SCOPES.join(' '),
      state,
    });
    const url = `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
    return { state, url };
  }

  async validateState(state: string): Promise<boolean> {
    const key = STATE_REDIS_KEY_PREFIX + state;
    const stored = await this.redis.get(key);
    if (stored !== state) {
      return false;
    }
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
