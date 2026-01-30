import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Company,
  CompanyMember,
  CompanyInvite,
  User,
} from '@app/shared';
import { TeamService } from './team.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, CompanyMember, CompanyInvite, User]),
  ],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
