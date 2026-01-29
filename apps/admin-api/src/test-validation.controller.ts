import { Body, Controller, Post } from '@nestjs/common';
import { TestValidationDto } from './test-validation.dto';
import { Public } from './auth/decorators/public.decorator';

@Controller('test-validation')
@Public()
export class TestValidationController {
  @Post()
  validate(@Body() dto: TestValidationDto): { ok: boolean; value: string } {
    return { ok: true, value: dto.value };
  }
}
