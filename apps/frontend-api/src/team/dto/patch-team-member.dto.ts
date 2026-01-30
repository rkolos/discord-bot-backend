import { IsEnum } from 'class-validator';
import { CompanyMemberRole } from '@app/shared';

export class PatchTeamMemberDto {
  @IsEnum(CompanyMemberRole)
  role: CompanyMemberRole;
}
