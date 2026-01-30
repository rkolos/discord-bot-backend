import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guild, Counter, Widget, SharedConfigModule } from '@app/shared';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({
  imports: [
    SharedConfigModule,
    TypeOrmModule.forFeature([Guild, Counter, Widget]),
  ],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
