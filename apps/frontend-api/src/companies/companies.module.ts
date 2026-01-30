import { Module } from '@nestjs/common';
import { GuildsModule } from '../guilds/guilds.module';
import { CompaniesController } from './companies.controller';

@Module({
  imports: [GuildsModule],
  controllers: [CompaniesController],
})
export class CompaniesModule {}
