import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { UsersService } from './users.service';
import { UsersQueryDto } from './dto/users-query.dto';
import { UserIdParamDto } from './dto/user-id-param.dto';
import { BanUserDto } from './dto/ban-user.dto';

@Controller('users')
@UseGuards(AdminAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getUsers(
    @Query() query: UsersQueryDto,
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
    return this.usersService.getUsers(
      query.page ?? 1,
      query.limit ?? 10,
      query.search,
      query.status,
      query.plan,
      query.sortBy,
      query.sortOrder as 'asc' | 'desc',
    );
  }

  @Get(':id')
  async getUserById(
    @Param() params: UserIdParamDto,
  ): Promise<{
    data: {
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
      activityLog: Array<{
        id: string;
        action: string;
        timestamp: string;
        details: string | null;
      }>;
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
    };
  }> {
    const data = await this.usersService.getUserById(params.id);
    return { data };
  }

  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  async banUser(
    @Param() params: UserIdParamDto,
    @Body() dto: BanUserDto,
  ): Promise<{ data: { success: true } }> {
    const data = await this.usersService.banUser(params.id, dto.reason);
    return { data };
  }

  @Post(':id/unban')
  @HttpCode(HttpStatus.OK)
  async unbanUser(
    @Param() params: UserIdParamDto,
  ): Promise<{ data: { success: true } }> {
    const data = await this.usersService.unbanUser(params.id);
    return { data };
  }

  @Post(':id/impersonate')
  @HttpCode(HttpStatus.OK)
  async impersonate(
    @Param() params: UserIdParamDto,
  ): Promise<{ data: { token: string } }> {
    const data = await this.usersService.impersonate(params.id);
    return { data };
  }

  @Get(':id/billing')
  async getBilling(
    @Param() params: UserIdParamDto,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{
    data: {
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
    };
  }> {
    const data = await this.usersService.getBilling(
      params.id,
      page ?? 1,
      limit ?? 10,
    );
    return { data };
  }
}
