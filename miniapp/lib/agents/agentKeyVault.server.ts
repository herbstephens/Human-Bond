import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { zeroGKvStorageFromEnv } from './zeroGKv';

export type StoredAgentKey = {
  version: 1;
  address: `0x${string}`;
  ciphertext: string;
  iv: string;
  authTag: string;
  createdAt: number;
  agentBook: {
    status: 'pending' | 'registered';
    nonce: string;
    txHash?: `0x${string}`;
  };
};

function encryptionKey(): Buffer {
  const value = process.env.ZG_AGENT_KEY_ENCRYPTION_KEY;
  if (!value || !/^(0x)?[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      'ZG_AGENT_KEY_ENCRYPTION_KEY must be a random 32-byte hex key in miniapp/.env.local',
    );
  }
  return Buffer.from(value.replace(/^0x/, ''), 'hex');
}

function storageKey(address: string): string {
  return `agent-keys/${address.toLowerCase()}`;
}

/**
 * Read-your-own-write for the activation flow.
 *
 * 0G-KV is eventually consistent: putJson submits a storage transaction and the
 * KV node indexes it afterwards. Activation writes the key in /activate/start and
 * reads it back in /activate/complete seconds later — far inside that window, so
 * the read hangs until the client times out and registration never reaches the
 * relay. Keeping what we just wrote in process closes the gap.
 *
 * 0G-KV stays the system of record: this only serves records THIS process wrote,
 * and any address it has not seen still goes to the network.
 */
const recentWrites = new Map<string, StoredAgentKey>();

export async function createAndStoreAgentKey(nonce: bigint): Promise<StoredAgentKey> {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(privateKey, 'utf8'),
    cipher.final(),
  ]);

  const record: StoredAgentKey = {
    version: 1,
    address: account.address,
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    createdAt: Date.now(),
    agentBook: {
      status: 'pending',
      nonce: nonce.toString(),
    },
  };

  await zeroGKvStorageFromEnv().putJson(storageKey(account.address), record);
  recentWrites.set(account.address.toLowerCase(), record);
  return record;
}

export async function getStoredAgentKey(address: `0x${string}`): Promise<StoredAgentKey> {
  const justWritten = recentWrites.get(address.toLowerCase());
  if (justWritten) return justWritten;

  const record = await zeroGKvStorageFromEnv().getJson<StoredAgentKey>(storageKey(address));
  if (record.address.toLowerCase() !== address.toLowerCase()) {
    throw new Error('Stored agent-key address does not match the requested agent');
  }
  return record;
}

export async function markAgentRegistered(
  record: StoredAgentKey,
  txHash: `0x${string}`,
): Promise<void> {
  const updated = {
    ...record,
    agentBook: {
      ...record.agentBook,
      status: 'registered',
      txHash,
    },
  } satisfies StoredAgentKey;
  recentWrites.set(record.address.toLowerCase(), updated);
  await zeroGKvStorageFromEnv().putJson(storageKey(record.address), updated);
}

export async function loadAgentPrivateKey(address: `0x${string}`): Promise<`0x${string}`> {
  const record = await getStoredAgentKey(address);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(record.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
  const privateKey = Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('Decrypted agent private key has an invalid format');
  }
  return privateKey as `0x${string}`;
}
