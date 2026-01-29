import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CryptoModule } from '@app/shared';
import { Guild, GuildModule, ServerSettings } from '@app/shared';
import { AuthModule } from '../auth/auth.module';
import { GuildsController } from './guilds.controller';
import { GuildsService } from './guilds.service';
import { GuildAdminGuard } from './guards/guild-admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Guild, GuildModule, ServerSettings]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 0,
    }),
    CryptoModule,
    AuthModule,
  ],
  controllers: [GuildsController],
  providers: [GuildsService, GuildAdminGuard],
  exports: [GuildsService, GuildAdminGuard],
})
export class GuildsModule {}
