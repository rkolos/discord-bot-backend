import {
  ClickHouseModule,
  DatabaseModule,
  RedisModule,
  SharedConfigModule,
} from '@app/shared';
import { Module } from '@nestjs/common';
import { TestValidationController } from './test-validation.controller';

@Module({
  imports: [
    SharedConfigModule,
    DatabaseModule,
    RedisModule.forRootAsync(),
    ClickHouseModule.forRootAsync(),
  ],
  controllers: [TestValidationController],
})
export class AppModule {}
