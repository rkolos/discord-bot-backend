import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  Param,
  Post,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '@app/shared';
import { MeService } from './me.service';
import { GuildsService } from '../guilds/guilds.service';
import { TeamService } from '../team/team.service';
import { PatchMeDto } from './dto/patch-me.dto';
import { MeGuildsQueryDto } from './dto/me-guilds-query.dto';
import { TeamQueryDto } from '../team/dto/team-query.dto';
import { InviteTeamDto } from '../team/dto/invite-team.dto';
import { PatchTeamMemberDto } from '../team/dto/patch-team-member.dto';
import { MemberIdParamDto } from '../team/dto/member-id-param.dto';
import { BillingService } from '../billing/billing.service';
import { UpgradeSubscriptionDto } from '../billing/dto/upgrade-subscription.dto';
import { InvoicesQueryDto } from '../billing/dto/invoices-query.dto';
import { InvoiceIdParamDto } from '../billing/dto/invoice-id-param.dto';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(
    private readonly meService: MeService,
    private readonly guildsService: GuildsService,
    private readonly teamService: TeamService,
    private readonly billingService: BillingService,
  ) {}

  @Get()
  async getMe(
    @CurrentUser() user: User,
  ): Promise<{
    data: {
      id: string;
      name: string;
      email: string | null;
      avatar: string | null;
    };
  }> {
    const data = await this.meService.getMe(user.id);
    return { data };
  }

  @Get('guilds')
  async getMyGuilds(
    @CurrentUser() user: User,
    @Query() query: MeGuildsQueryDto,
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
    return this.guildsService.getMeGuildsPaginated(
      user.id,
      query.page ?? 1,
      query.limit ?? 20,
      query.search,
    );
  }

  @Get('team')
  async getTeam(
    @CurrentUser() user: User,
    @Query() query: TeamQueryDto,
  ): Promise<{
    data: Array<{
      id: string;
      name: string;
      email: string | null;
      avatar: string | null;
      role: string;
      joinedAt: string;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.teamService.getTeamMembers(
      user.id,
      query.page ?? 1,
      query.limit ?? 20,
      query.search,
    );
  }

  @Post('team/invite')
  @HttpCode(HttpStatus.CREATED)
  async inviteTeamMember(
    @CurrentUser() user: User,
    @Body() dto: InviteTeamDto,
  ): Promise<{ data: { success: true; inviteToken: string } }> {
    const data = await this.teamService.inviteTeamMember(
      user.id,
      dto.email,
      dto.role,
    );
    return { data };
  }

  @Patch('team/:memberId')
  async updateTeamMember(
    @CurrentUser() user: User,
    @Param() params: MemberIdParamDto,
    @Body() dto: PatchTeamMemberDto,
  ): Promise<{
    data: {
      id: string;
      name: string;
      email: string | null;
      avatar: string | null;
      role: string;
      joinedAt: string;
    };
  }> {
    const data = await this.teamService.updateTeamMemberRole(
      user.id,
      params.memberId,
      dto.role,
    );
    return { data };
  }

  @Delete('team/:memberId')
  async removeTeamMember(
    @CurrentUser() user: User,
    @Param() params: MemberIdParamDto,
  ): Promise<{ data: { success: true } }> {
    const data = await this.teamService.removeTeamMember(user.id, params.memberId);
    return { data };
  }

  @Get('subscription')
  async getSubscription(
    @CurrentUser() user: User,
  ): Promise<{
    data: { id: string; name: string; price: number; pricePeriod: string };
  }> {
    const data = await this.billingService.getSubscription(user.id);
    return { data };
  }

  @Post('subscription/upgrade')
  async upgradeSubscription(
    @CurrentUser() user: User,
    @Body() dto: UpgradeSubscriptionDto,
  ): Promise<{
    data: { id: string; name: string; price: number; pricePeriod: string };
  }> {
    const data = await this.billingService.upgradeSubscription(
      user.id,
      dto.planId,
      dto.pricePeriod,
    );
    return { data };
  }

  @Post('subscription/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(
    @CurrentUser() user: User,
  ): Promise<{ data: { success: true } }> {
    const data = await this.billingService.cancelSubscription(user.id);
    return { data };
  }

  @Get('usage')
  async getUsage(
    @CurrentUser() user: User,
  ): Promise<{
    data: {
      servers: { used: number; limit: number; isOverLimit: boolean };
      members: { used: number; limit: number; isOverLimit: boolean };
      messages: { used: number; limit: number; isOverLimit: boolean };
    };
  }> {
    const data = await this.billingService.getUsage(user.id);
    return { data };
  }

  @Get('invoices')
  async getInvoices(
    @CurrentUser() user: User,
    @Query() query: InvoicesQueryDto,
  ): Promise<{
    data: Array<{
      id: string;
      amount: number;
      currency: string;
      date: string;
      status: string;
      downloadUrl: string | null;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.billingService.getInvoices(
      user.id,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get('invoices/:invoiceId/download')
  async downloadInvoice(
    @CurrentUser() user: User,
    @Param() params: InvoiceIdParamDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.billingService.getInvoiceDownload(
      user.id,
      params.invoiceId,
    );
    if (!result) {
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: 'Invoice not found',
      });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.content);
  }

  @Patch()
  async updateMe(
    @CurrentUser() user: User,
    @Body() dto: PatchMeDto,
  ): Promise<{
    data: {
      id: string;
      name: string;
      email: string | null;
      avatar: string | null;
    };
  }> {
    const data = await this.meService.updateMe(user.id, {
      name: dto.name,
      email: dto.email,
      avatar: dto.avatar,
    });
    return { data };
  }
}
