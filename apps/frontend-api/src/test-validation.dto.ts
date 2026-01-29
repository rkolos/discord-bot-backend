import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO для E2E-проверки контракта валидации (VALIDATION_ERROR, Envelope).
 * POST /api/test-validation
 */
export class TestValidationDto {
  @IsString()
  @IsNotEmpty({ message: 'value is required' })
  @MaxLength(100, { message: 'value must be at most 100 characters' })
  value!: string;
}
