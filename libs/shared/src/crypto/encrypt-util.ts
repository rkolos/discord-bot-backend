import {
  createCipheriv,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const VERSION = 'v1';

/**
 * Шифрует строку в формат v1:iv:tag:ciphertext (AES-256-GCM).
 * Используется в CryptoService и в seed-скрипте.
 * @param plainText - текст для шифрования
 * @param key - ключ 32 символа (UTF-8)
 */
export function encryptToken(plainText: string, key: string): string {
  if (typeof key !== 'string' || key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 characters');
  }
  const keyBuf = Buffer.from(key, 'utf8');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, keyBuf, iv, {
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
