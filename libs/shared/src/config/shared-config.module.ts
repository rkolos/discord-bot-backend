import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './env-validation.schema';
import { SharedConfigService } from './shared-config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { allowUnknown: true },
    }),
  ],
  providers: [SharedConfigService],
  exports: [SharedConfigService],
})
export class SharedConfigModule {}
