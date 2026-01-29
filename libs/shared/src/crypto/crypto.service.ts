import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { SharedConfigService } from '../config/shared-config.service';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION = 'v1';

@Injectable()
export class CryptoService {
  constructor(private readonly sharedConfig: SharedConfigService) {}

  /**
   * Validates encryption key at service init (get auth() throws if invalid).
   */
  private getKey(): Buffer {
    const key = this.sharedConfig.auth.encryptionKeyV1;
    return Buffer.from(key, 'utf8');
  }

  encrypt(plainText: string): string {
    const key = this.getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      VERSION,
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
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
    const key = this.getKey();
    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
  }
}
