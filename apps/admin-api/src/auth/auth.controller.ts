import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto';
import { SharedConfigService } from '@app/shared';
import { AdminAuthGuard } from './admin-auth.guard';
import { CurrentAdmin } from './decorators/current-admin.decorator';
import { Public } from './decorators/public.decorator';
import { AdminUser } from '@app/shared';

const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
const COOKIE_PATH = '/api/auth/refresh';
const COOKIE_MAX_AGE_DAYS = 7;
const COOKIE_MAX_AGE_SECONDS = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sharedConfig: SharedConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    data: {
      accessToken: string;
      user: {
        id: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        role: string;
      };
    };
  }> {
    const { accessToken, refreshToken, expiresAt, user } =
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
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
        },
      },
    };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  async me(
    @CurrentAdmin() admin: AdminUser,
  ): Promise<{
    data: {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      role: string;
    };
  }> {
    return {
      data: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        avatarUrl: admin.avatarUrl,
        role: admin.role,
      },
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: { accessToken: string } }> {
    const refreshTokenValue = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!refreshTokenValue) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
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
  @UseGuards(AdminAuthGuard)
  async logout(
    @CurrentAdmin() admin: AdminUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ data: { success: true } }> {
    const refreshTokenValue = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    await this.authService.logout(admin.id, refreshTokenValue);
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
