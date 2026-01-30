import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import {
  User,
  Guild,
  ActivityLog,
  Invoice,
  SharedConfigModule,
  SharedConfigService,
} from '@app/shared';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Guild, ActivityLog, Invoice]),
    JwtModule.registerAsync({
      imports: [SharedConfigModule],
      useFactory: (config: SharedConfigService) => ({
        secret: config.auth.jwtSecret,
      }),
      inject: [SharedConfigService],
    }),
    SharedConfigModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
