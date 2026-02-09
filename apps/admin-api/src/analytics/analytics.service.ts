import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Counter,
  CounterStatus,
  CounterMetric,
  Widget,
  Guild,
  User,
} from '@app/shared';

const METRIC_TO_SPEC_TYPE: Record<string, string> = {
  [CounterMetric.MEMBERS]: 'members_total',
  [CounterMetric.ONLINE]: 'members_online',
  [CounterMetric.IDLE]: 'members_idle',
  [CounterMetric.DND]: 'members_dnd',
  [CounterMetric.OFFLINE]: 'members_offline',
  [CounterMetric.VOICE]: 'voice_connected',
  [CounterMetric.BOTS]: 'game_activity',
  [CounterMetric.MESSAGES]: 'messages',
};

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(Widget)
    private readonly widgetRepository: Repository<Widget>,
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getCounters(from?: string, to?: string): Promise<{
    distribution: Array<{
      type: string;
      count: number;
      percentage: number;
      popularTemplate: string;
    }>;
    topTemplates: Array<{ template: string; usageCount: number }>;
    totalActive: number;
    avgPerGuild: number;
  }> {
    const qb = this.counterRepository
      .createQueryBuilder('c')
      .where('c.status = :status', { status: CounterStatus.ACTIVE });
    if (from) {
      qb.andWhere('c.created_at >= :from', { from: new Date(from) });
    }
    if (to) {
      const toEnd = new Date(to);
      toEnd.setUTCHours(23, 59, 59, 999);
      qb.andWhere('c.created_at <= :to', { to: toEnd });
    }
    const counters = await qb.getMany();
    const totalActive = counters.length;
    const byMetric = new Map<
      string,
      { count: number; templates: Map<string, number> }
    >();
    const templateCount = new Map<string, number>();
    for (const c of counters) {
      const type = METRIC_TO_SPEC_TYPE[c.metric ?? ''] ?? c.metric ?? 'other';
      if (!byMetric.has(type)) {
        byMetric.set(type, { count: 0, templates: new Map() });
      }
      const rec = byMetric.get(type)!;
      rec.count += 1;
      rec.templates.set(c.template, (rec.templates.get(c.template) ?? 0) + 1);
      templateCount.set(c.template, (templateCount.get(c.template) ?? 0) + 1);
    }
    const distribution = Array.from(byMetric.entries())
      .map(([type, { count, templates }]) => {
        const popularTemplate =
          Array.from(templates.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
          '{count}';
        return {
          type,
          count,
          percentage: totalActive > 0 ? Math.round((count / totalActive) * 1000) / 10 : 0,
          popularTemplate,
        };
      })
      .sort((a, b) => b.count - a.count);
    const topTemplates = Array.from(templateCount.entries())
      .map(([template, usageCount]) => ({ template, usageCount }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);
    const guildIds = new Set(counters.map((c) => c.guildId));
    const avgPerGuild =
      guildIds.size > 0 ? Math.round((totalActive / guildIds.size) * 100) / 100 : 0;
    return {
      distribution,
      topTemplates,
      totalActive,
      avgPerGuild,
    };
  }

  async getWidgets(from?: string, to?: string): Promise<{
    totalViews: number;
    totalClicks: number;
    ctr: number;
    timeSeries: Array<{ date: string; value: number; value2: number }>;
    topReferrers: Array<{ domain: string; views: number; clicks: number }>;
  }> {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const totalViews = 0;
    const totalClicks = 0;
    const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
    const timeSeries: Array<{ date: string; value: number; value2: number }> = [];
    const current = new Date(fromDate);
    current.setUTCHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setUTCHours(0, 0, 0, 0);
    while (current <= end) {
      timeSeries.push({
        date: current.toISOString().slice(0, 10),
        value: 0,
        value2: 0,
      });
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return {
      totalViews,
      totalClicks,
      ctr,
      timeSeries,
      topReferrers: [],
    };
  }

  async getGrowth(from?: string, to?: string): Promise<{
    sources: Array<{ source: string; installs: number; percentage: number }>;
    leaderboard: Array<{
      userId: string;
      username: string;
      avatarUrl: string;
      invitesCount: number;
      retentionRate?: number;
    }>;
    totalInstalls: number;
  }> {
    const toDate = to ? new Date(to) : new Date();
    const toEnd = new Date(toDate);
    toEnd.setUTCHours(23, 59, 59, 999);
    const fromDate = from ? new Date(from) : null;
    const countQb = this.guildRepository
      .createQueryBuilder('g')
      .where('g.created_at <= :toEnd', { toEnd });
    if (fromDate) {
      countQb.andWhere('g.created_at >= :fromDate', { fromDate });
    }
    const totalInstalls = await countQb.getCount();
    const guildsQb = this.guildRepository
      .createQueryBuilder('g')
      .where('g.created_at <= :toEnd', { toEnd })
      .leftJoinAndSelect('g.owner', 'owner');
    if (fromDate) {
      guildsQb.andWhere('g.created_at >= :fromDate', { fromDate });
    }
    const guildsInRange = await guildsQb.getMany();
    const byOwner = new Map<
      string,
      { user: User; count: number; guilds: Guild[] }
    >();
    for (const g of guildsInRange) {
      const ownerId = g.ownerId;
      if (!byOwner.has(ownerId)) {
        const owner = g.owner ?? (await this.userRepository.findOne({ where: { id: ownerId } }));
        byOwner.set(ownerId, {
          user: owner!,
          count: 0,
          guilds: [],
        });
      }
      const rec = byOwner.get(ownerId)!;
      rec.count += 1;
      rec.guilds.push(g);
    }
    const leaderboard = Array.from(byOwner.values())
      .filter((r) => r.user)
      .map((r) => ({
        userId: r.user.id,
        username: r.user.username,
        avatarUrl: r.user.avatarUrl ?? '',
        invitesCount: r.count,
        retentionRate: undefined as number | undefined,
      }))
      .sort((a, b) => b.invitesCount - a.invitesCount)
      .slice(0, 20);
    const sources = [
      { source: 'App Directory', installs: totalInstalls, percentage: 100 },
    ];
    return {
      sources,
      leaderboard,
      totalInstalls,
    };
  }

  async getCommands(_from?: string, _to?: string): Promise<
    Array<{
      commandName: string;
      category: string;
      executionCount: number;
      errorCount: number;
      errorRate: number;
      avgLatency: number;
    }>
  > {
    return [];
  }

  async getLeaderboards(): Promise<
    Array<{
      id: string;
      name: string;
      iconUrl: string | null;
      memberCount: number;
      ownerName: string;
      plan: string;
    }>
  > {
    const guilds = await this.guildRepository.find({
      order: { memberCount: 'DESC' },
      take: 50,
      relations: ['owner'],
    });
    return guilds.map((g) => ({
      id: g.id,
      name: g.name,
      iconUrl: g.iconUrl,
      memberCount: g.memberCount,
      ownerName: g.owner?.username ?? '—',
      plan: g.owner?.plan ?? g.subscriptionTier ?? 'free',
    }));
  }
}
