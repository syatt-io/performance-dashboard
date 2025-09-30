import CryptoJS from 'crypto-js';

// Get encryption key from environment variable
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY as string;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

if (ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters long for secure encryption');
}

/**
 * Encrypts sensitive data before storing in database
 * @param text - The text to encrypt
 * @returns Encrypted string
 */
export function encrypt(text: string): string {
  if (!text || text.trim() === '') {
    return text;
  }

  try {
    const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt sensitive data');
  }
}

/**
 * Decrypts sensitive data retrieved from database
 * @param encryptedText - The encrypted text to decrypt
 * @returns Decrypted string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText || encryptedText.trim() === '') {
    return encryptedText;
  }

  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);

    if (!decryptedText) {
      throw new Error('Decryption produced empty result - possibly wrong key');
    }

    return decryptedText;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt sensitive data');
  }
}

/**
 * Checks if a string appears to be encrypted (for migration purposes)
 * @param text - Text to check
 * @returns True if text appears to be encrypted
 */
export function isEncrypted(text: string): boolean {
  if (!text || text.length < 10) return false;

  // AES encrypted strings are base64 encoded and have specific characteristics
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  return base64Regex.test(text) && text.length > 20;
}

/**
 * Safely encrypts credentials, checking if already encrypted
 * @param credentials - Object with apiKey and accessToken
 * @returns Object with encrypted credentials
 */
export function encryptCredentials(credentials: { apiKey?: string; accessToken?: string }) {
  const result = { ...credentials };

  if (result.apiKey && !isEncrypted(result.apiKey)) {
    result.apiKey = encrypt(result.apiKey);
  }

  if (result.accessToken && !isEncrypted(result.accessToken)) {
    result.accessToken = encrypt(result.accessToken);
  }

  return result;
}

/**
 * Safely decrypts credentials, checking if encrypted
 * @param credentials - Object with potentially encrypted apiKey and accessToken
 * @returns Object with decrypted credentials
 */
export function decryptCredentials(credentials: { apiKey?: string; accessToken?: string }) {
  const result = { ...credentials };

  if (result.apiKey && isEncrypted(result.apiKey)) {
    try {
      result.apiKey = decrypt(result.apiKey);
    } catch (error) {
      console.warn('Failed to decrypt API key, may be plain text');
    }
  }

  if (result.accessToken && isEncrypted(result.accessToken)) {
    try {
      result.accessToken = decrypt(result.accessToken);
    } catch (error) {
      console.warn('Failed to decrypt access token, may be plain text');
    }
  }

  return result;
}