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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly discordOAuth: DiscordOAuthService,
    private readonly authService: AuthService,
    private readonly sharedConfig: SharedConfigService,
  ) {}

  @Get('discord')
  @ApiOperation({
    summary: 'Redirect to Discord OAuth',
    description:
      'Redirects the user to Discord OAuth consent page. Use when starting Discord login flow. Returns 302 redirect.',
  })
  async discordInitiate(
    @Query('redirect_uri') redirectUriFromQuery: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { url } = await this.discordOAuth.buildLoginUrl(redirectUriFromQuery);
    res.redirect(302, url);
  }

  @Get('discord/login')
  @ApiOperation({
    summary: 'Redirect to Discord OAuth',
    description:
      'Redirects the user to Discord OAuth consent page. Use when starting Discord login flow. Requires redirect_uri (frontend callback, e.g. {origin}/login/callback). Returns 302 redirect.',
  })
  async discordLogin(
    @Query('redirect_uri') redirectUriFromQuery: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { url } = await this.discordOAuth.buildLoginUrl(redirectUriFromQuery);
    res.redirect(302, url);
  }

  @Get('discord/callback')
  @ApiOperation({
    summary: 'Discord OAuth callback (GET)',
    description:
      'Handles redirect from Discord after user authorizes. Exchanges code for tokens, creates/updates user, sets cookies and redirects. Called by Discord; do not call directly unless simulating OAuth flow.',
  })
  async discordCallbackGet(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const errorRedirectUrl =
      this.sharedConfig.discord.frontendBaseUrl != null
        ? `${this.sharedConfig.discord.frontendBaseUrl}/login/callback?error=OAUTH_FAILED`
        : null;

    if (!code || !state) {
      if (errorRedirectUrl) {
        res.redirect(302, errorRedirectUrl);
        return;
      }
      throw new HttpException(
        {
          code: 'OAUTH_FAILED',
          message: 'Discord OAuth authentication failed',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const stateData =
      await this.discordOAuth.getStateDataAndConsume(state);
    if (!stateData) {
      if (errorRedirectUrl) {
        res.redirect(302, errorRedirectUrl);
        return;
      }
      throw new HttpException(
        {
          code: 'OAUTH_FAILED',
          message: 'Discord OAuth authentication failed',
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
        (this.sharedConfig.discord.frontendBaseUrl != null
          ? `${this.sharedConfig.discord.frontendBaseUrl}/login/callback`
          : '/login/callback');
      const separator = frontendRedirect.includes('?') ? '&' : '?';
      res.redirect(302, `${frontendRedirect}${separator}token=${accessToken}`);
    } catch {
      const targetUrl =
        stateData.redirectUri ??
        (this.sharedConfig.discord.frontendBaseUrl != null
          ? `${this.sharedConfig.discord.frontendBaseUrl}/login/callback`
          : null);
      if (targetUrl) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        res.redirect(302, `${targetUrl}${separator}error=OAUTH_FAILED`);
        return;
      }
      throw new HttpException(
        {
          code: 'OAUTH_FAILED',
          message: 'Discord OAuth authentication failed',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Post('discord/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify Discord token and get JWT',
    description:
      'Exchanges a Discord OAuth token for a platform JWT and user info. Use after user returns from Discord OAuth with a token; returns accessToken and user for authenticated API calls.',
  })
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
  @ApiOperation({
    summary: 'Register new user',
    description:
      'Creates a new user account with email and password. Returns JWT access token and user; sets refresh token in cookie. Use for sign-up flow.',
  })
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
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Authenticates user by email and password. Returns JWT access token and user; sets refresh token in cookie. Use for sign-in; then use the token in Authorization header for protected endpoints.',
  })
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
  @ApiOperation({
    summary: 'Discord OAuth callback (POST)',
    description:
      'Exchanges Discord OAuth code for platform session. Body: code, state. Use when client received code from Discord redirect; returns JWT and user, sets refresh cookie.',
  })
  async discordCallback(
    @Body() dto: DiscordCallbackDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    data: { token: string; user: { id: string; name: string; email: string | null; avatar: string | null } };
  }> {
    const valid = await this.discordOAuth.validateState(dto.state);
    if (!valid) {
      throw new ForbiddenException({
        code: 'OAUTH_FAILED',
        message: 'Invalid or expired state',
      });
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
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Issues a new access token using the refresh token from cookie. Use when access token expires; returns new accessToken, updates refresh cookie.',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: { accessToken: string } }> {
    const refreshTokenValue = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!refreshTokenValue) {
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        message: 'Missing refresh token',
      });
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
  @ApiOperation({
    summary: 'Logout current user',
    description:
      'Invalidates the current session and Discord token. Requires Bearer JWT. Use when user signs out; clears server-side session and refresh cookie.',
  })
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
