import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { ShardingManager } from 'discord.js';

@Injectable()
export class ShardingManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShardingManagerService.name);
  private manager: ShardingManager | null = null;
  private readonly readyShardIds = new Set<number>();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const token = this.configService.get<string>('DISCORD_BOT_TOKEN');
    if (!token || typeof token !== 'string') {
      this.logger.warn('DISCORD_BOT_TOKEN not set; main bot shards will not start');
      return;
    }

    const workerPath = join(__dirname, '..', 'shard', 'shard-worker.js');
    this.manager = new ShardingManager(workerPath, {
      token,
      totalShards: 'auto',
    });

    this.manager.on('shardCreate', (shard) => {
      this.logger.log(`Shard ${shard.id} created`);
      shard.on('ready', () => {
        this.readyShardIds.add(shard.id);
        this.logger.log(`Shard ${shard.id} READY`);
      });
      shard.on('disconnect', () => {
        this.readyShardIds.delete(shard.id);
      });
      shard.on('death', () => {
        this.readyShardIds.delete(shard.id);
      });
    });

    const spawnTimeoutMs = this.configService.get<number>('SHARD_READY_TIMEOUT_MS') ?? 90_000;
    await this.manager.spawn({ timeout: spawnTimeoutMs });
    this.logger.log('ShardingManager spawned all shards');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.manager) {
      this.manager = null;
      this.readyShardIds.clear();
      this.logger.log('ShardingManager destroyed');
    }
  }

  getManager(): ShardingManager | null {
    return this.manager;
  }

  isGatewayReady(): boolean {
    return this.readyShardIds.size > 0;
  }
}
