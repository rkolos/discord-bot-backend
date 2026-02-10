import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CompanyMemberRole } from '@app/shared';

export class InviteTeamDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsEnum(CompanyMemberRole)
  role: CompanyMemberRole;
}
