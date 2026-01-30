import { IsEmail, IsEnum } from 'class-validator';
import { CompanyMemberRole } from '@app/shared';

export class InviteTeamDto {
  @IsEmail()
  email: string;

  @IsEnum(CompanyMemberRole)
  role: CompanyMemberRole;
}
