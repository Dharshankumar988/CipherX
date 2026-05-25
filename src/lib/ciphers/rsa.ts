import forge from 'node-forge';

export function generateRSAKeys() {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  return {
    publicKey: forge.pki.publicKeyToPem(keypair.publicKey),
    privateKey: forge.pki.privateKeyToPem(keypair.privateKey)
  };
}

export function encryptRSA(text: string, publicKeyPem: string): string {
  try {
    const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    const encrypted = publicKey.encrypt(text, 'RSA-OAEP');
    return forge.util.encode64(encrypted);
  } catch (e) {
    return 'Encryption failed. Invalid Public Key.';
  }
}

export function decryptRSA(ciphertext: string, privateKeyPem: string): string {
  try {
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const decoded = forge.util.decode64(ciphertext);
    return privateKey.decrypt(decoded, 'RSA-OAEP');
  } catch (e) {
    return 'Decryption failed. Invalid Private Key or Data.';
  }
}
