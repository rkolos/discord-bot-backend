import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TestValidationDto } from './test-validation.dto';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('Test Validation')
@Controller('test-validation')
@Public()
export class TestValidationController {
  @Post()
  @ApiOperation({
    summary: 'Test validation',
    description: 'Echo endpoint for testing DTO validation (value). Returns ok and value. Public.',
  })
  validate(@Body() dto: TestValidationDto): { ok: boolean; value: string } {
    return { ok: true, value: dto.value };
  }
}
