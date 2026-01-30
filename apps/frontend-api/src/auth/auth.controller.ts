import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Res,
  Req,
  UnauthorizedException,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { DiscordOAuthService } from './discord-oauth.service';
import {
  DiscordCallbackDto,
  DiscordVerifyDto,
  RegisterDto,
  LoginDto,
} from './dto';
import { SharedConfigService } from '@app/shared';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '@app/shared';

const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
const COOKIE_PATH = '/api/auth/refresh';
const COOKIE_MAX_AGE_DAYS = 7;
const COOKIE_MAX_AGE_SECONDS = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly discordOAuth: DiscordOAuthService,
    private readonly authService: AuthService,
    private readonly sharedConfig: SharedConfigService,
  ) {}

  @Get('discord')
  async discordInitiate(
    @Query('redirect_uri') redirectUriFromQuery: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { url } = await this.discordOAuth.buildLoginUrl(redirectUriFromQuery);
    res.redirect(302, url);
  }

  @Get('discord/login')
  async discordLogin(
    @Query('redirect_uri') redirectUriFromQuery?: string,
  ): Promise<{ url: string }> {
    const { url } = await this.discordOAuth.buildLoginUrl(redirectUriFromQuery);
    return { url };
  }

  @Get('discord/callback')
  async discordCallbackGet(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!code || !state) {
      throw new HttpException(
        {
          error: {
            code: 'OAUTH_FAILED',
            message: 'Discord OAuth authentication failed',
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const stateData =
      await this.discordOAuth.getStateDataAndConsume(state);
    if (!stateData) {
      throw new HttpException(
        {
          error: {
            code: 'OAUTH_FAILED',
            message: 'Discord OAuth authentication failed',
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    try {
      const redirectUri = this.sharedConfig.discord.oauthRedirectUri;
      const tokenResponse = await this.discordOAuth.exchangeCodeForToken(
        code,
        redirectUri,
      );
      const discordUser = await this.discordOAuth.getDiscordUser(
        tokenResponse.access_token,
      );
      const user = await this.authService.upsertUserFromDiscord(discordUser);
      const { accessToken, refreshToken, expiresAt } =
        await this.authService.createSession(user);
      await this.discordOAuth.storeDiscordToken(
        user.id,
        tokenResponse.access_token,
        tokenResponse.expires_in,
      );
      const isProduction = this.sharedConfig.isDevelopment === false;
      res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: COOKIE_PATH,
        maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
        expires: expiresAt,
      });
      const frontendRedirect =
        stateData.redirectUri ??
        (this.sharedConfig.discord.frontendBaseUrl
          ? `${this.sharedConfig.discord.frontendBaseUrl}/dashboard`
          : '/dashboard');
      const separator = frontendRedirect.includes('?') ? '&' : '?';
      res.redirect(302, `${frontendRedirect}${separator}token=${accessToken}`);
    } catch {
      throw new HttpException(
        {
          error: {
            code: 'OAUTH_FAILED',
            message: 'Discord OAuth authentication failed',
          },
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Post('discord/verify')
  @HttpCode(HttpStatus.OK)
  async discordVerify(
    @Body() dto: DiscordVerifyDto,
  ): Promise<{
    data: {
      token: string;
      user: { id: string; name: string; email: string | null; avatar: string | null };
    };
  }> {
    const { accessToken, user } =
      await this.authService.verifyDiscordToken(dto.discordToken);
    return {
      data: {
        token: accessToken,
        user: {
          id: user.id,
          name: user.username,
          email: user.email,
          avatar: user.avatarUrl,
        },
      },
    };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    data: {
      token: string;
      user: { id: string; name: string; email: string | null; avatar: string | null };
    };
  }> {
    const { user, accessToken, refreshToken, expiresAt } =
      await this.authService.register(dto.fullName, dto.email, dto.password);
    const isProduction = this.sharedConfig.isDevelopment === false;
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
      expires: expiresAt,
    });
    return {
      data: {
        token: accessToken,
        user: {
          id: user.id,
          name: user.username,
          email: user.email,
          avatar: user.avatarUrl,
        },
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    data: {
      token: string;
      user: { id: string; name: string; email: string | null; avatar: string | null };
    };
  }> {
    const { user, accessToken, refreshToken, expiresAt } =
      await this.authService.login(dto.email, dto.password);
    const isProduction = this.sharedConfig.isDevelopment === false;
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
      expires: expiresAt,
    });
    return {
      data: {
        token: accessToken,
        user: {
          id: user.id,
          name: user.username,
          email: user.email,
          avatar: user.avatarUrl,
        },
      },
    };
  }

  @Post('discord/callback')
  @HttpCode(HttpStatus.OK)
  async discordCallback(
    @Body() dto: DiscordCallbackDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    data: { token: string; user: { id: string; name: string; email: string | null; avatar: string | null } };
  }> {
    const valid = await this.discordOAuth.validateState(dto.state);
    if (!valid) {
      throw new ForbiddenException('Invalid or expired state');
    }
    const redirectUri = this.sharedConfig.discord.oauthRedirectUri;
    const tokenResponse = await this.discordOAuth.exchangeCodeForToken(
      dto.code,
      redirectUri,
    );
    const discordUser = await this.discordOAuth.getDiscordUser(
      tokenResponse.access_token,
    );
    const user = await this.authService.upsertUserFromDiscord(discordUser);
    const { accessToken, refreshToken, expiresAt } =
      await this.authService.createSession(user);
    await this.discordOAuth.storeDiscordToken(
      user.id,
      tokenResponse.access_token,
      tokenResponse.expires_in,
    );
    const isProduction =
      this.sharedConfig.isDevelopment === false;
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
      expires: expiresAt,
    });
    return {
      data: {
        token: accessToken,
        user: {
          id: user.id,
          name: user.username,
          email: user.email,
          avatar: user.avatarUrl,
        },
      },
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: { accessToken: string } }> {
    const refreshTokenValue = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!refreshTokenValue) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const { accessToken, refreshToken, expiresAt } =
      await this.authService.refresh(refreshTokenValue);
    const isProduction = this.sharedConfig.isDevelopment === false;
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: COOKIE_MAX_AGE_SECONDS * 1000,
      expires: expiresAt,
    });
    return { data: { accessToken } };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: { success: true } }> {
    const refreshTokenValue = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    await this.authService.logout(user.id, refreshTokenValue);
    await this.discordOAuth.deleteDiscordToken(user.id);
    const isProduction = this.sharedConfig.isDevelopment === false;
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      path: COOKIE_PATH,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    });
    return { data: { success: true } };
  }
}
