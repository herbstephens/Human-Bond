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
  /** The partner wallet this agent acts for — the wallet→agent half of the link. */
  owner?: `0x${string}`;
  bondId?: string;
  agentBook: {
    status: 'pending' | 'registered';
    nonce: string;
    txHash?: `0x${string}`;
    /** AgentBook's anonymous human identifier (nullifier hash), once registered. */
    humanId?: string;
  };
};

/** The agent→owner link, inverted: which agent acts for this wallet. */
type OwnerLink = {
  agentAddress: `0x${string}`;
  bondId?: string;
  updatedAt: number;
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

function ownerKey(wallet: string): string {
  return `agent-owner/${wallet.toLowerCase()}`;
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
const recentOwnerLinks = new Map<string, OwnerLink>();

export async function createAndStoreAgentKey(
  nonce: bigint,
  link?: { owner: `0x${string}`; bondId?: string },
): Promise<StoredAgentKey> {
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
    owner: link?.owner,
    bondId: link?.bondId,
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
  humanId?: string,
): Promise<void> {
  const updated = {
    ...record,
    agentBook: {
      ...record.agentBook,
      status: 'registered',
      txHash,
      humanId: humanId ?? record.agentBook.humanId,
    },
  } satisfies StoredAgentKey;
  recentWrites.set(record.address.toLowerCase(), updated);
  await zeroGKvStorageFromEnv().putJson(storageKey(record.address), updated);

  // The wallet→agent link is written only now, after AgentBook accepted the
  // proof — an aborted activation must never repoint a wallet at an
  // unregistered agent. Last successful registration wins.
  if (updated.owner) {
    const linkRecord: OwnerLink = {
      agentAddress: updated.address,
      bondId: updated.bondId,
      updatedAt: Date.now(),
    };
    recentOwnerLinks.set(updated.owner.toLowerCase(), linkRecord);
    await zeroGKvStorageFromEnv().putJson(ownerKey(updated.owner), linkRecord);
  }
}

/**
 * Which agent acts for this wallet — the read side of the link, used by
 * verify-backing to resolve wallet → agent before the on-chain lookupHuman.
 * Null means no agent finished registration for this wallet yet.
 *
 * The KV node hangs (no timeout in the SDK) on keys it has never seen — which
 * is precisely the common case here, a wallet that hasn't registered. So the
 * network read races an 8s deadline; on timeout the wallet is treated as
 * unlinked. The in-process map answers instantly for anything THIS server
 * registered, which covers both partners in the shared-server demo.
 */
export async function agentAddressForOwner(
  wallet: `0x${string}`,
): Promise<`0x${string}` | null> {
  const justLinked = recentOwnerLinks.get(wallet.toLowerCase());
  if (justLinked) return justLinked.agentAddress;

  try {
    const link = await Promise.race([
      zeroGKvStorageFromEnv().getJsonOrNull<OwnerLink>(ownerKey(wallet)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('0G-KV owner-link read timed out')), 8_000),
      ),
    ]);
    return link?.agentAddress ?? null;
  } catch (caught) {
    console.warn(`[agent-vault] owner link for ${wallet} unavailable: ${String(caught)}`);
    return null;
  }
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
