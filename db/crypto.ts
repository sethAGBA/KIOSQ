import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';

/**
 * Chiffre une chaîne avec AES-256-GCM.
 * Format stocké : "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encrypt(plaintext: string, key: string): string {
  const keyBuf = Buffer.from(key, 'hex');
  if (keyBuf.length !== 32) throw new Error('Clé de chiffrement invalide : 32 bytes hex requis');
  const iv     = randomBytes(12);               // 96 bits recommandé pour GCM
  const cipher = createCipheriv(ALGO, keyBuf, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Déchiffre une chaîne produite par `encrypt`.
 * @throws si le format est invalide ou si l'authentification échoue.
 */
export function decrypt(ciphertext: string, key: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Format de ciphertext invalide');

  const [ivHex, authTagHex, dataHex] = parts;
  const keyBuf  = Buffer.from(key, 'hex');
  const iv      = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data    = Buffer.from(dataHex, 'hex');

  const decipher = createDecipheriv(ALGO, keyBuf, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
