import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import db from '../db';

export type VaultOwnerType = 'user' | 'guild';

type VaultCredentialRow = {
  key_name: string;
  encrypted_value: string;
};

const IV_LENGTH = 12;
const KEY_FILE_PATH = path.join(__dirname, '../../data/vault.key');

function ensureHexKey(value: string, source: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error(`${source} must be a 32-byte hex string`);
  }
  return normalized;
}

function loadOrCreateKeyMaterial(): Buffer {
  const envKey = process.env.VAULT_MASTER_KEY;
  if (envKey) {
    return Buffer.from(ensureHexKey(envKey, 'VAULT_MASTER_KEY'), 'hex');
  }

  fs.mkdirSync(path.dirname(KEY_FILE_PATH), { recursive: true });

  if (fs.existsSync(KEY_FILE_PATH)) {
    const fileKey = fs.readFileSync(KEY_FILE_PATH, 'utf8');
    return Buffer.from(ensureHexKey(fileKey, 'data/vault.key'), 'hex');
  }

  const generatedKey = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(KEY_FILE_PATH, generatedKey, { encoding: 'utf8', mode: 0o600 });
  return Buffer.from(generatedKey, 'hex');
}

const masterKey = crypto.createHash('sha256').update(loadOrCreateKeyMaterial()).digest();

const upsertCredentialStatement = db.prepare(`
  INSERT INTO vault_credentials (owner_id, owner_type, key_name, encrypted_value)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(owner_id, owner_type, key_name)
  DO UPDATE SET
    encrypted_value = excluded.encrypted_value,
    updated_at = CURRENT_TIMESTAMP
`);

const getCredentialStatement = db.prepare(`
  SELECT encrypted_value
  FROM vault_credentials
  WHERE owner_id = ? AND owner_type = ? AND key_name = ?
`);

const listCredentialsStatement = db.prepare(`
  SELECT key_name
  FROM vault_credentials
  WHERE owner_id = ? AND owner_type = ?
  ORDER BY key_name COLLATE NOCASE ASC
`);

const deleteCredentialStatement = db.prepare(`
  DELETE FROM vault_credentials
  WHERE owner_id = ? AND owner_type = ? AND key_name = ?
`);

function validateEncodedPayload(encoded: string): [string, string, string] {
  const parts = encoded.split(':');
  if (parts.length !== 3 || parts.some((part) => !part || /[^0-9a-f]/i.test(part))) {
    throw new Error('Invalid encrypted payload format');
  }
  return [parts[0], parts[1], parts[2]];
}

function normalizeKeyName(key: string): string {
  const normalized = key.trim();
  if (!normalized) {
    throw new Error('Credential key is required');
  }
  return normalized;
}

class VaultService {
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
  }

  decrypt(encoded: string): string {
    const [ivHex, authTagHex, ciphertextHex] = validateEncodedPayload(encoded);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      masterKey,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }

  setCredential(
    ownerId: string,
    ownerType: VaultOwnerType,
    key: string,
    value: string
  ): void {
    const keyName = normalizeKeyName(key);
    upsertCredentialStatement.run(ownerId, ownerType, keyName, this.encrypt(value));
  }

  getCredential(ownerId: string, ownerType: VaultOwnerType, key: string): string | null {
    const keyName = normalizeKeyName(key);
    const row = getCredentialStatement.get(ownerId, ownerType, keyName) as
      | { encrypted_value: string }
      | undefined;

    if (!row) {
      return null;
    }

    return this.decrypt(row.encrypted_value);
  }

  listCredentials(ownerId: string, ownerType: VaultOwnerType): string[] {
    return (listCredentialsStatement.all(ownerId, ownerType) as VaultCredentialRow[]).map(
      (row) => row.key_name
    );
  }

  deleteCredential(ownerId: string, ownerType: VaultOwnerType, key: string): boolean {
    const keyName = normalizeKeyName(key);
    const result = deleteCredentialStatement.run(ownerId, ownerType, keyName);
    return result.changes > 0;
  }
}

export default new VaultService();
