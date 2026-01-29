import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import {
  SharedConfigModule,
  SharedConfigService,
  User,
  RefreshToken,
} from '@app/shared';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DiscordOAuthService } from './discord-oauth.service';

@Module({
  imports: [
    SharedConfigModule,
    TypeOrmModule.forFeature([User, RefreshToken]),
    JwtModule.registerAsync({
      imports: [SharedConfigModule],
      useFactory: (sharedConfig: SharedConfigService) => ({
        secret: sharedConfig.auth.jwtSecret,
      }),
      inject: [SharedConfigService],
    }),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 0,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, DiscordOAuthService],
  exports: [AuthService],
})
export class AuthModule {}
