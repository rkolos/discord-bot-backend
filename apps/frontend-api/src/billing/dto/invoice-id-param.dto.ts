import { IsUUID } from 'class-validator';

export class InvoiceIdParamDto {
  @IsUUID()
  invoiceId: string;
}
