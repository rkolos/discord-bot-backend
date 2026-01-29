import { SharedConfigModule } from '@app/shared';
import { Module } from '@nestjs/common';

@Module({
  imports: [SharedConfigModule],
})
export class AppModule {}
