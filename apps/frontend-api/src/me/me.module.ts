import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@app/shared';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { GuildsModule } from '../guilds/guilds.module';
import { TeamModule } from '../team/team.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    GuildsModule,
    TeamModule,
    BillingModule,
  ],
  controllers: [MeController],
  providers: [MeService],
  exports: [MeService],
})
export class MeModule {}
