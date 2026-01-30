import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@app/shared';
import { GuildsService } from '../guilds/guilds.service';
import { CompanyIdParamDto } from './dto/company-id-param.dto';
import { CompanyGuildsQueryDto } from './dto/company-guilds-query.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly guildsService: GuildsService) {}

  @Get(':companyId/guilds')
  async getCompanyGuilds(
    @CurrentUser() user: User,
    @Param() params: CompanyIdParamDto,
    @Query() query: CompanyGuildsQueryDto,
  ): Promise<{
    data: Array<{
      id: string;
      name: string;
      icon: string;
      status: string;
      memberCount: number;
      messageCount: number;
      lastActivity: string | null;
      ownerId: string;
      subscriptionTier: string;
      onlineMembers: number;
      memberGrowth: number;
      banner: string;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.guildsService.getCompanyGuildsPaginated(
      params.companyId,
      user.id,
      query.page ?? 1,
      query.limit ?? 20,
      query.search,
    );
  }
}
