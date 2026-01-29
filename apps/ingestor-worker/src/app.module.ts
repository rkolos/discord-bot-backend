import { RedisModule, SharedConfigModule } from '@app/shared';
import { Module } from '@nestjs/common';

@Module({
  imports: [SharedConfigModule, RedisModule.forRootAsync()],
})
export class AppModule {}
