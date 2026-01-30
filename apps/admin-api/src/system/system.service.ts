import {
  Injectable,
  NotFoundException,
  HttpException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { RedisService, SharedConfigService } from '@app/shared';
import { Guild, Counter, Widget } from '@app/shared';

const KNOWN_QUEUE_NAMES = [
  'workers-queue-counters-update',
  'ingestor-raw-events',
  'workers-queue-gdpr-user-delete',
  'workers-queue-logs-config',
];

const SHARD_KEY_PREFIX = 'bot-service:shard:';
const MAINTENANCE_KEY = 'admin-api:maintenance';

@Injectable()
export class SystemService implements OnModuleInit, OnModuleDestroy {
  private queues: Map<string, Queue> = new Map();

  constructor(
    private readonly redis: RedisService,
    private readonly sharedConfig: SharedConfigService,
    @InjectRepository(Guild)
    private readonly guildRepository: Repository<Guild>,
    @InjectRepository(Counter)
    private readonly counterRepository: Repository<Counter>,
    @InjectRepository(Widget)
    private readonly widgetRepository: Repository<Widget>,
  ) {}

  onModuleInit(): void {
    const { host, port, password, prefix } = this.sharedConfig.redis;
    for (const name of KNOWN_QUEUE_NAMES) {
      const queue = new Queue(name, {
        connection: { host, port, password: password ?? undefined },
        prefix,
      });
      this.queues.set(name, queue);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      Array.from(this.queues.values()).map((q) => q.close()),
    );
    this.queues.clear();
  }

  private getShardKeyPrefix(): string {
    return SHARD_KEY_PREFIX;
  }

  private getMaintenanceKey(): string {
    return MAINTENANCE_KEY;
  }

  async getHealthSummary(): Promise<{
    api: string;
    gateway: string;
    database: string;
    queues: string;
  }> {
    let database: string = 'ok';
    try {
      await this.guildRepository.query('SELECT 1');
    } catch {
      database = 'error';
    }
    let gateway: string = 'ok';
    try {
      const client = this.redis.getClient();
      const keys = await client.keys(`${this.getShardKeyPrefix()}*`);
      if (keys.length === 0) gateway = 'degraded';
    } catch {
      gateway = 'error';
    }
    let queues: string = 'ok';
    try {
      for (const queue of this.queues.values()) {
        const counts = await queue.getJobCounts();
        if ((counts.failed ?? 0) > 100) queues = 'degraded';
        if ((counts.failed ?? 0) > 1000) {
          queues = 'error';
          break;
        }
      }
    } catch {
      queues = 'error';
    }
    return {
      api: 'ok',
      gateway,
      database,
      queues,
    };
  }

  async getShards(): Promise<
    Array<{
      id: number;
      status: string;
      ping: number;
      guildCount: number;
      uptimeSeconds: number;
    }>
  > {
    const client = this.redis.getClient();
    const prefix = this.getShardKeyPrefix();
    const keys = await client.keys(`${prefix}*`);
    const result: Array<{
      id: number;
      status: string;
      ping: number;
      guildCount: number;
      uptimeSeconds: number;
    }> = [];
    for (const key of keys.sort()) {
      const idStr = key.split(':').pop() ?? '';
      const id = parseInt(idStr, 10);
      if (Number.isNaN(id)) continue;
      const data = await client.hgetall(key);
      const status =
        data?.status === 'READY' ? 'online' : (data?.status ?? 'disconnected');
      const ping = parseInt(data?.ping ?? '0', 10) || 0;
      const guildCount = parseInt(data?.guildCount ?? '0', 10) || 0;
      const timestamp = parseInt(data?.timestamp ?? '0', 10);
      const uptimeSeconds =
        timestamp > 0 ? Math.floor((Date.now() - timestamp) / 1000) : 0;
      result.push({
        id,
        status: status.toLowerCase(),
        ping,
        guildCount,
        uptimeSeconds,
      });
    }
    result.sort((a, b) => a.id - b.id);
    return result;
  }

  async restartShard(id: number): Promise<{ success: boolean }> {
    const shards = await this.getShards();
    const shard = shards.find((s) => s.id === id);
    if (!shard) {
      throw new NotFoundException({
        code: 'SHARD_NOT_FOUND',
        message: `Shard with id ${id} not found`,
      });
    }
    throw new HttpException(
      {
        code: 'NOT_IMPLEMENTED',
        message: 'Shard restart requires bot-service internal API',
      },
      501,
    );
  }

  async syncGuild(id: string): Promise<{ success: boolean; syncedAt: string }> {
    const guild = await this.guildRepository.findOne({ where: { id } });
    if (!guild) {
      throw new NotFoundException({
        code: 'GUILD_NOT_FOUND',
        message: `Guild with id '${id}' not found`,
      });
    }
    throw new HttpException(
      {
        code: 'NOT_IMPLEMENTED',
        message: 'Manual guild sync requires bot-service integration',
      },
      501,
    );
  }

  async getQueues(): Promise<
    Array<{
      queueName: string;
      active: number;
      waiting: number;
      delayed: number;
      failed: number;
      paused: boolean;
    }>
  > {
    const result: Array<{
      queueName: string;
      active: number;
      waiting: number;
      delayed: number;
      failed: number;
      paused: boolean;
    }> = [];
    for (const [name, queue] of this.queues) {
      const counts = await queue.getJobCounts();
      const isPaused = await queue.isPaused();
      result.push({
        queueName: name,
        active: counts.active ?? 0,
        waiting: counts.waiting ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        paused: isPaused,
      });
    }
    return result;
  }

  async getStalledJobs(queueName?: string): Promise<
    Array<{
      jobId: string;
      queueName: string;
      jobName: string;
      timestamp: string;
      attempts: number;
    }>
  > {
    const names = queueName
      ? KNOWN_QUEUE_NAMES.filter((n) => n === queueName)
      : KNOWN_QUEUE_NAMES;
    const result: Array<{
      jobId: string;
      queueName: string;
      jobName: string;
      timestamp: string;
      attempts: number;
    }> = [];
    for (const name of names) {
      const queue = this.queues.get(name);
      if (!queue) continue;
      let stalled: Array<{ id?: string; name?: string; timestamp?: number; attemptsMade?: number }> = [];
      if (typeof (queue as unknown as { getStalled?: () => Promise<unknown[]> }).getStalled === 'function') {
        stalled = (await (queue as unknown as { getStalled: () => Promise<Array<{ id?: string; name?: string; timestamp?: number; attemptsMade?: number }>> }).getStalled()) ?? [];
      }
      for (const job of stalled) {
        result.push({
          jobId: String(job.id ?? ''),
          queueName: name,
          jobName: String(job.name ?? 'unknown'),
          timestamp: job.timestamp
            ? new Date(job.timestamp).toISOString()
            : new Date().toISOString(),
          attempts: job.attemptsMade ?? 0,
        });
      }
    }
    return result;
  }

  async retryFailed(queueName: string): Promise<{
    success: boolean;
    retriedCount: number;
  }> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new NotFoundException({
        code: 'QUEUE_NOT_FOUND',
        message: `Queue '${queueName}' not found`,
      });
    }
    const failed = await queue.getFailed();
    let retriedCount = 0;
    for (const job of failed) {
      await job.retry();
      retriedCount += 1;
    }
    return { success: true, retriedCount };
  }

  async setMaintenanceMode(enabled: boolean): Promise<{
    maintenanceMode: boolean;
  }> {
    const key = this.getMaintenanceKey();
    if (enabled) {
      await this.redis.set(key, '1', 86400 * 7);
    } else {
      await this.redis.del(key);
    }
    return { maintenanceMode: enabled };
  }

  async cleanupOrphans(): Promise<{
    success: boolean;
    countersRemoved: number;
    widgetsRemoved: number;
    jobsRemoved: number;
  }> {
    const guildIds = new Set(
      (await this.guildRepository.find({ select: ['id'] })).map((g) => g.id),
    );
    const counters = await this.counterRepository.find({
      select: ['id', 'guildId'],
    });
    const toRemoveCounters = counters.filter((c) => !guildIds.has(c.guildId));
    const widgets = await this.widgetRepository.find({
      select: ['id', 'guildId'],
    });
    const toRemoveWidgets = widgets.filter((w) => !guildIds.has(w.guildId));
    let countersRemoved = 0;
    let widgetsRemoved = 0;
    for (const c of toRemoveCounters) {
      await this.counterRepository.delete(c.id);
      countersRemoved += 1;
    }
    for (const w of toRemoveWidgets) {
      await this.widgetRepository.delete(w.id);
      widgetsRemoved += 1;
    }
    return {
      success: true,
      countersRemoved,
      widgetsRemoved,
      jobsRemoved: 0,
    };
  }

  async getLogs(
    limit: number,
    cursor?: string,
    _level?: string,
    _service?: string,
  ): Promise<{
    data: Array<{
      timestamp: string;
      level: string;
      message: string;
      service: string;
    }>;
    meta: { cursor: string; hasMore: boolean };
  }> {
    return {
      data: [],
      meta: { cursor: cursor ?? new Date().toISOString(), hasMore: false },
    };
  }
}
