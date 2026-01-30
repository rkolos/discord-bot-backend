import { IsUUID } from 'class-validator';

export class CompanyIdParamDto {
  @IsUUID()
  companyId: string;
}
