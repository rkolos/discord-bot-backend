import { Module } from '@nestjs/common';
import { SharedConfigModule } from '../config/shared-config.module';
import { CryptoService } from './crypto.service';

@Module({
  imports: [SharedConfigModule],
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
