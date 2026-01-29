import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  SharedConfigModule,
  SharedConfigService,
  AdminUser,
  AdminRefreshToken,
  ActivityLog,
} from '@app/shared';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { AdminJwtStrategy } from './admin-jwt.strategy';

@Module({
  imports: [
    SharedConfigModule,
    PassportModule,
    TypeOrmModule.forFeature([AdminUser, AdminRefreshToken, ActivityLog]),
    JwtModule.registerAsync({
      imports: [SharedConfigModule],
      useFactory: (sharedConfig: SharedConfigService) => {
        const secret = sharedConfig.auth.adminJwtSecret;
        if (!secret) {
          throw new Error(
            'ADMIN_JWT_SECRET is required for admin-api. Set it in .env.',
          );
        }
        return { secret };
      },
      inject: [SharedConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [PasswordService, AuthService, AdminJwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
