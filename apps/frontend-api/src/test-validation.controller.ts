import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TestValidationDto } from './test-validation.dto';

@ApiTags('Test Validation')
@Controller('test-validation')
export class TestValidationController {
  @Post()
  @ApiOperation({
    summary: 'Test validation',
    description:
      'Echo endpoint for testing DTO validation (value). Returns ok and value.',
  })
  validate(@Body() dto: TestValidationDto): { ok: boolean; value: string } {
    return { ok: true, value: dto.value };
  }
}
