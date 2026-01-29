import { Body, Controller, Post } from '@nestjs/common';
import { TestValidationDto } from './test-validation.dto';

@Controller('test-validation')
export class TestValidationController {
  @Post()
  validate(@Body() dto: TestValidationDto): { ok: boolean; value: string } {
    return { ok: true, value: dto.value };
  }
}
