import {
  DatabaseModule,
  RedisModule,
  SharedConfigModule,
} from '@app/shared';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { GuildsModule } from './guilds/guilds.module';
import { TestValidationController } from './test-validation.controller';

@Module({
  imports: [
    SharedConfigModule,
    DatabaseModule,
    RedisModule.forRootAsync(),
    AuthModule,
    GuildsModule,
  ],
  controllers: [TestValidationController],
})
export class AppModule {}
