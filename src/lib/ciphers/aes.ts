import CryptoJS from 'crypto-js';

export function encryptAES(text: string, secretKey: string): string {
  if (!secretKey) return text;
  return CryptoJS.AES.encrypt(text, secretKey).toString();
}

export function decryptAES(ciphertext: string, secretKey: string): string {
  if (!secretKey) return ciphertext;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return 'Decryption failed (Invalid Key or Corrupted Data)';
  }
}
