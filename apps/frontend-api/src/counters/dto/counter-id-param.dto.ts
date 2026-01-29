import { IsUUID } from 'class-validator';

export class CounterIdParamDto {
  @IsUUID('4')
  id: string;
}
