import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
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

    const dates: string[] = [];
    const current = new Date(fromDate);
    current.setUTCHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setUTCHours(0, 0, 0, 0);

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    const timeSeries: GrowthTimeSeriesPointDto[] = [];

    for (const dateStr of dates) {
      const endOfDay = new Date(dateStr + 'T23:59:59.999Z');
      const [totalGuilds, totalUsers] = await Promise.all([
        this.guildRepository.count({
          where: { createdAt: LessThanOrEqual(endOfDay) },
        }),
        this.userRepository.count({
          where: { createdAt: LessThanOrEqual(endOfDay) },
        }),
      ]);
      timeSeries.push({
        date: dateStr,
        totalGuilds,
        totalUsers,
      });
    }

    return timeSeries;
  }
}
