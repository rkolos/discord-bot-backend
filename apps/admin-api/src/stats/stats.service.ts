import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guild } from '@app/shared';
import { User } from '@app/shared';

export interface GrowthTimeSeriesPointDto {
  date: string;
  totalGuilds: number;
  totalUsers: number;
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getGrowth(from?: string, to?: string): Promise<GrowthTimeSeriesPointDto[]> {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    if (fromDate > toDate) {
      return [];
    }

    const fromStr = fromDate.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    const rows = await this.guildRepository.manager.query<
      { date: string; total_guilds: string; total_users: string }[]
    >(
      `WITH date_series AS (
        SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS d
      )
      SELECT
        to_char(d, 'YYYY-MM-DD') AS date,
        (SELECT COUNT(*)::int FROM guilds WHERE created_at <= d::timestamptz + interval '23 hours 59 minutes 59.999 seconds') AS total_guilds,
        (SELECT COUNT(*)::int FROM users WHERE created_at <= d::timestamptz + interval '23 hours 59 minutes 59.999 seconds') AS total_users
      FROM date_series
      ORDER BY d`,
      [fromStr, toStr],
    );

    return rows.map((r) => ({
      date: r.date,
      totalGuilds: Number(r.total_guilds),
      totalUsers: Number(r.total_users),
    }));
  }
}
