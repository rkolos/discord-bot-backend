import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ShardingManagerService } from './sharding-manager.service';

@Module({
  imports: [ConfigModule],
  providers: [ShardingManagerService],
  exports: [ShardingManagerService],
})
export class ShardingModule {}
