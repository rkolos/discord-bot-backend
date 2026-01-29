import {
  DatabaseModule,
  RedisModule,
  SharedConfigModule,
} from '@app/shared';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { TestValidationController } from './test-validation.controller';

@Module({
  imports: [
    SharedConfigModule,
    DatabaseModule,
    RedisModule.forRootAsync(),
    AuthModule,
  ],
  controllers: [TestValidationController],
})
export class AppModule {}
