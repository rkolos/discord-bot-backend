import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  User,
  Guild,
  Company,
  CompanyInvite,
  CompanyMember,
  UserSubscription,
  UsageLimits,
  Invoice,
  RefreshToken,
} from '@app/shared';
import { SharedAnalyticsService } from '@app/shared';
import { GdprUserDeleteQueueService } from './gdpr-user-delete-queue.service';
import { DiscordOAuthService } from '../auth/discord-oauth.service';

@Injectable()
export class UserDataService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly discordOAuth: DiscordOAuthService,
    private readonly gdprQueue: GdprUserDeleteQueueService,
    private readonly sharedAnalytics: SharedAnalyticsService,
  ) {}

  /**
   * Полное удаление профиля пользователя (Right to be Forgotten): PostgreSQL и задача на удаление в ClickHouse.
   */
  async deleteAllUserData(user: User): Promise<void> {
    const userId = user.id;
    const discordId = user.discordId ?? null;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const guildRepo = queryRunner.manager.getRepository(Guild);
      const companyInviteRepo = queryRunner.manager.getRepository(CompanyInvite);
      const companyMemberRepo = queryRunner.manager.getRepository(CompanyMember);
      const companyRepo = queryRunner.manager.getRepository(Company);
      const userSubRepo = queryRunner.manager.getRepository(UserSubscription);
      const userRepo = queryRunner.manager.getRepository(User);

      await guildRepo.delete({ ownerId: userId });
      await companyInviteRepo.delete({ invitedBy: userId });
      await companyMemberRepo.delete({ userId });
      await companyRepo.delete({ ownerId: userId });
      await userSubRepo.delete({ userId });
      await userRepo.delete({ id: userId });

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    await this.discordOAuth.deleteDiscordToken(userId);
    if (discordId) {
      await this.gdprQueue.addGdprUserDelete({ discordUserId: discordId });
    }
  }

  /**
   * Собрать все данные пользователя из PostgreSQL для экспорта (Data Portability).
   */
  async exportUserData(user: User): Promise<Record<string, unknown>> {
    const guildRepo = this.dataSource.getRepository(Guild);
    const userSubRepo = this.dataSource.getRepository(UserSubscription);
    const usageLimitsRepo = this.dataSource.getRepository(UsageLimits);
    const invoiceRepo = this.dataSource.getRepository(Invoice);
    const refreshTokenRepo = this.dataSource.getRepository(RefreshToken);
    const companyRepo = this.dataSource.getRepository(Company);
    const companyMemberRepo = this.dataSource.getRepository(CompanyMember);
    const companyInviteRepo = this.dataSource.getRepository(CompanyInvite);

    const [guilds, subscriptions, usageLimits, invoices, refreshTokensMeta, companiesOwned, companyMemberships, invitesSent, analytics] =
      await Promise.all([
        guildRepo.find({ where: { ownerId: user.id }, select: ['id', 'discordGuildId', 'name', 'createdAt', 'status', 'subscriptionTier'] }),
        userSubRepo.find({ where: { userId: user.id }, relations: ['plan'], select: { plan: { id: true, name: true } } }),
        usageLimitsRepo.findOne({ where: { userId: user.id } }).then((r) => r ?? null),
        invoiceRepo.find({ where: { userId: user.id }, select: ['id', 'amount', 'status', 'date'] }),
        refreshTokenRepo.find({ where: { userId: user.id }, select: ['id', 'expiresAt', 'createdAt', 'revokedAt'] }),
        companyRepo.find({ where: { ownerId: user.id }, select: ['id', 'name', 'createdAt'] }),
        companyMemberRepo.find({ where: { userId: user.id }, relations: ['company'], select: { company: { id: true, name: true } } }),
        companyInviteRepo.find({ where: { invitedBy: user.id }, select: ['id', 'email', 'role', 'expiresAt', 'createdAt'] }),
        this.sharedAnalytics.getUserStatsForExport(user.id, user.discordId ?? null),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        discordId: user.discordId,
        username: user.username,
        discriminator: user.discriminator,
        avatarUrl: user.avatarUrl,
        email: user.email,
        plan: user.plan,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      guildsOwned: guilds.map((g) => ({
        id: g.id,
        discordGuildId: g.discordGuildId,
        name: g.name,
        createdAt: g.createdAt,
        status: g.status,
        subscriptionTier: g.subscriptionTier,
      })),
      subscriptions: subscriptions.map((s) => ({
        planId: s.planId,
        planName: (s as { plan?: { name?: string } }).plan?.name,
        status: s.status,
        startedAt: s.startedAt,
        canceledAt: s.canceledAt,
      })),
      usageLimits: usageLimits ? { userId: usageLimits.userId } : null,
      invoices: invoices.map((i) => ({ id: i.id, amount: i.amount, status: i.status, date: i.date })),
      refreshTokensMeta: refreshTokensMeta.map((t) => ({ id: t.id, expiresAt: t.expiresAt, createdAt: t.createdAt, revokedAt: t.revokedAt })),
      companiesOwned: companiesOwned.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt })),
      companyMemberships: companyMemberships.map((m) => ({
        companyId: (m as { company?: { id: string; name: string } }).company?.id,
        companyName: (m as { company?: { name: string } }).company?.name,
      })),
      companyInvitesSent: invitesSent.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt, createdAt: i.createdAt })),
      analytics: {
        totalMessages: analytics.totalMessages,
        totalVoiceMinutes: analytics.totalVoiceMinutes,
      },
    };
  }
}
