import { DatabaseModule, SharedConfigModule } from '@app/shared';
import { Module } from '@nestjs/common';

@Module({
  imports: [SharedConfigModule, DatabaseModule],
})
export class AppModule {}
