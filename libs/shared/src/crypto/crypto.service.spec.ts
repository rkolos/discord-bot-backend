import { CryptoService } from './crypto.service';
import { SharedConfigService } from '../config/shared-config.service';

function mockSharedConfigService(): SharedConfigService {
  return {
    get auth() {
      return {
        jwtSecret: 'jwt-secret',
        encryptionKeyV1: 'a'.repeat(32),
      };
    },
  } as unknown as SharedConfigService;
}

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = new CryptoService(mockSharedConfigService());
  });

  describe('encrypt/decrypt roundtrip', () => {
    it('encrypt produces v1:iv:tag:cipher format with 12-byte IV', () => {
      const encrypted = service.encrypt('x');
      const parts = encrypted.split(':');
      expect(parts.length).toBeGreaterThanOrEqual(4);
      expect(parts[0]).toBe('v1');
      expect(Buffer.from(parts[1], 'base64').length).toBe(12);
    });

    it('decrypt(encrypt(X)) === X for ASCII string', () => {
      const plain = 'sensitive-token-value';
      const encrypted = service.encrypt(plain);
      expect(encrypted).not.toBe(plain);
      expect(encrypted.startsWith('v1:')).toBe(true);
      expect(service.decrypt(encrypted)).toBe(plain);
    });

    it('decrypt(encrypt(X)) === X for Unicode string', () => {
      const plain = 'токен с юникодом 🎭';
      const encrypted = service.encrypt(plain);
      expect(service.decrypt(encrypted)).toBe(plain);
    });

    it('decrypt(encrypt(X)) === X for empty string', () => {
      const plain = '';
      const encrypted = service.encrypt(plain);
      expect(service.decrypt(encrypted)).toBe(plain);
    });

    it('produces different ciphertext for same plaintext (random IV)', () => {
      const plain = 'same';
      const a = service.encrypt(plain);
      const b = service.encrypt(plain);
      expect(a).not.toBe(b);
      expect(service.decrypt(a)).toBe(plain);
      expect(service.decrypt(b)).toBe(plain);
    });
  });

  describe('decrypt tamper protection', () => {
    it('throws when ciphertext is modified by one byte', () => {
      const plain = 'secret';
      const encrypted = service.encrypt(plain);
      const parts = encrypted.split(':');
      const cipherB64 = parts[3];
      const buf = Buffer.from(cipherB64, 'base64');
      buf[0] ^= 0x01;
      const tampered = [parts[0], parts[1], parts[2], buf.toString('base64')].join(':');
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('throws when authTag is modified by one byte', () => {
      const plain = 'secret';
      const encrypted = service.encrypt(plain);
      const parts = encrypted.split(':');
      const tagB64 = parts[2];
      const buf = Buffer.from(tagB64, 'base64');
      buf[0] ^= 0x01;
      const tampered = [parts[0], parts[1], buf.toString('base64'), parts[3]].join(':');
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('throws when IV is modified', () => {
      const plain = 'secret';
      const encrypted = service.encrypt(plain);
      const parts = encrypted.split(':');
      const ivB64 = parts[1];
      const buf = Buffer.from(ivB64, 'base64');
      buf[0] ^= 0x01;
      const tampered = [parts[0], buf.toString('base64'), parts[2], parts[3]].join(':');
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('throws when format has no v1 prefix', () => {
      const plain = 'secret';
      const encrypted = service.encrypt(plain);
      const parts = encrypted.split(':');
      const wrongPrefix = ['v2', parts[1], parts[2], parts[3]].join(':');
      expect(() => service.decrypt(wrongPrefix)).toThrow(/Unsupported encryption version/);
    });
  });
});
