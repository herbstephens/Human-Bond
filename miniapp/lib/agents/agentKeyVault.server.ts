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
  return record;
}

export async function getStoredAgentKey(address: `0x${string}`): Promise<StoredAgentKey> {
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
  await zeroGKvStorageFromEnv().putJson(storageKey(record.address), {
    ...record,
    agentBook: {
      ...record.agentBook,
      status: 'registered',
      txHash,
    },
  } satisfies StoredAgentKey);
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
