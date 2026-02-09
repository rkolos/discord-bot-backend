import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import {
  Counter,
  CounterMetric,
  COUNTERS_UPDATE_QUEUE_NAME,
  type CounterUpdateJobPayload,
  SharedConfigService,
} from '@app/shared';

@Injectable()
export class CountersQueueProducerService implements OnModuleDestroy {
  private readonly queue: Queue<CounterUpdateJobPayload>;

  constructor(
    private readonly sharedConfig: SharedConfigService,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
  ) {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    this.queue = new Queue<CounterUpdateJobPayload>(COUNTERS_UPDATE_QUEUE_NAME, {
      connection: { host, port, password: password ?? undefined },
      prefix,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  async addCounterUpdate(counter: Counter): Promise<void> {
    await this.queue.add('update', {
      counter_id: counter.id,
      guild_id: counter.guildId,
      channel_id: counter.channelId,
      type: counter.type,
      metric: counter.metric,
      role_id: counter.roleId ?? undefined,
    } as CounterUpdateJobPayload, { priority: 0 });
  }

  async addCounterUpdatesForGuildRoles(guildId: string, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) return;
    const counters = await this.counterRepository.find({
      where: { guildId, metric: CounterMetric.ROLE, roleId: In(roleIds) },
      select: ['id', 'guildId', 'channelId', 'type', 'metric', 'roleId'],
    });
    for (const c of counters) {
      await this.addCounterUpdate(c as Counter);
    }
  }

  async addCounterUpdatesForGuildMembers(guildId: string): Promise<void> {
    const counters = await this.counterRepository.find({
      where: { guildId, metric: CounterMetric.MEMBERS },
      select: ['id', 'guildId', 'channelId', 'type', 'metric'],
    });
    for (const c of counters) {
      await this.addCounterUpdate(c as Counter);
    }
  }

  async addCounterUpdatesForGuildPresence(guildId: string): Promise<void> {
    const counters = await this.counterRepository.find({
      where: {
        guildId,
        metric: In([CounterMetric.ONLINE, CounterMetric.IDLE, CounterMetric.DND, CounterMetric.OFFLINE]),
      },
      select: ['id', 'guildId', 'channelId', 'type', 'metric'],
    });
    for (const c of counters) {
      await this.addCounterUpdate(c as Counter);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
