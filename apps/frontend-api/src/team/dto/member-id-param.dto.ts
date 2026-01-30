import { IsUUID } from 'class-validator';

export class MemberIdParamDto {
  @IsUUID()
  memberId: string;
}
