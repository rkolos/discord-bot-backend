import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
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
import { GuildsModule } from '../guilds/guilds.module';
import { TeamModule } from '../team/team.module';
import { DiscordOAuthService } from './discord-oauth.service';
import { PasswordService } from './password.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    SharedConfigModule,
    PassportModule,
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
    forwardRef(() => GuildsModule),
    TeamModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, DiscordOAuthService, PasswordService, JwtStrategy],
  exports: [AuthService, DiscordOAuthService],
})
export class AuthModule {}
