import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Company,
  CompanyMember,
  CompanyInvite,
  User,
  SharedConfigModule,
} from '@app/shared';
import { TeamService } from './team.service';
import { InviteController } from './invite.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company, CompanyMember, CompanyInvite, User]),
    SharedConfigModule,
  ],
  controllers: [InviteController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
