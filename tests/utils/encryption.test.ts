import { encrypt, decrypt, encryptCredentials, decryptCredentials, isEncrypted } from '../../src/utils/encryption';

describe('Encryption Utils', () => {
  describe('encrypt/decrypt basic functions', () => {
    it('should encrypt a string', () => {
      const plaintext = 'test-api-key';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should decrypt an encrypted string back to original', () => {
      const plaintext = 'test-api-key';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(1000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?~`';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('isEncrypted', () => {
    it('should identify encrypted strings', () => {
      const plaintext = 'test-api-key';
      const encrypted = encrypt(plaintext);

      expect(isEncrypted(encrypted)).toBe(true);
      expect(isEncrypted(plaintext)).toBe(false);
    });

    it('should return false for short strings', () => {
      expect(isEncrypted('short')).toBe(false);
      expect(isEncrypted('')).toBe(false);
    });
  });

  describe('encryptCredentials', () => {
    it('should encrypt apiKey and accessToken', () => {
      const credentials = {
        apiKey: 'test-api-key',
        accessToken: 'test-access-token'
      };

      const encrypted = encryptCredentials(credentials);

      expect(encrypted.apiKey).toBeDefined();
      expect(encrypted.apiKey).not.toBe(credentials.apiKey);
      expect(encrypted.accessToken).toBeDefined();
      expect(encrypted.accessToken).not.toBe(credentials.accessToken);
    });

    it('should not double-encrypt already encrypted credentials', () => {
      const credentials = {
        apiKey: 'test-api-key',
      };

      const encrypted1 = encryptCredentials(credentials);
      const encrypted2 = encryptCredentials(encrypted1);

      expect(encrypted1.apiKey).toBe(encrypted2.apiKey);
    });

    it('should handle partial credentials', () => {
      const onlyApiKey = encryptCredentials({ apiKey: 'test-key' });
      const onlyToken = encryptCredentials({ accessToken: 'test-token' });

      expect(onlyApiKey.apiKey).toBeDefined();
      expect(onlyApiKey.accessToken).toBeUndefined();
      expect(onlyToken.accessToken).toBeDefined();
      expect(onlyToken.apiKey).toBeUndefined();
    });
  });

  describe('decryptCredentials', () => {
    it('should decrypt encrypted credentials', () => {
      const original = {
        apiKey: 'test-api-key',
        accessToken: 'test-access-token'
      };

      const encrypted = encryptCredentials(original);
      const decrypted = decryptCredentials(encrypted);

      expect(decrypted.apiKey).toBe(original.apiKey);
      expect(decrypted.accessToken).toBe(original.accessToken);
    });

    it('should not attempt to decrypt plain text', () => {
      const plainCredentials = {
        apiKey: 'plain-api-key',
        accessToken: 'plain-token'
      };

      const result = decryptCredentials(plainCredentials);

      expect(result.apiKey).toBe(plainCredentials.apiKey);
      expect(result.accessToken).toBe(plainCredentials.accessToken);
    });
  });

  describe('round-trip encryption', () => {
    it('should maintain data integrity for various inputs', () => {
      const testCases = [
        { apiKey: 'simple-api-key' },
        { apiKey: 'API_KEY_WITH_UNDERSCORES' },
        { apiKey: 'key-with-dashes-123', accessToken: 'token-123' },
        { apiKey: 'KeyWithMixedCase123' },
        { apiKey: 'very-long-api-key-' + 'x'.repeat(200) },
      ];

      testCases.forEach(testCase => {
        const encrypted = encryptCredentials(testCase);
        const decrypted = decryptCredentials(encrypted);
        expect(decrypted).toEqual(testCase);
      });
    });
  });
});
