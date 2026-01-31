import { Injectable } from '@nestjs/common';
import { createDecipheriv } from 'node:crypto';
import { SharedConfigService } from '../config/shared-config.service';
import { encryptToken } from './encrypt-util';

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;
const VERSION = 'v1';

@Injectable()
export class CryptoService {
  constructor(private readonly sharedConfig: SharedConfigService) {}

  /**
   * Validates encryption key at service init (get auth() throws if invalid).
   */
  private getKey(): string {
    return this.sharedConfig.auth.encryptionKeyV1;
  }

  encrypt(plainText: string): string {
    return encryptToken(plainText, this.getKey());
  }

  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts[0] !== VERSION || parts.length < 4) {
      throw new Error('Unsupported encryption version or invalid format');
    }
    const ivB64 = parts[1];
    const authTagB64 = parts[2];
    const cipherB64 = parts.slice(3).join(':');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(cipherB64, 'base64');
    const key = Buffer.from(this.getKey(), 'utf8');
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
  }
}
