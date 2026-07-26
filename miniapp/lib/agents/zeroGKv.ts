/**
 * HBStorage on 0G-KV — second brain, charter, and history live on 0G.
 *
 * Writes go through the flow contract (a funded key on Galileo testnet is
 * required — faucet.0g.ai); reads go straight to a KV node. Keys map 1:1 to
 * the HBStorage namespaces (brain/<human>, charter/<bondId>, history/<bondId>).
 * Logs are read-modify-write JSON arrays under the log key — fine for the
 * demo's write volume.
 */
import { Batcher, Indexer, KvClient, FixedPriceFlow__factory } from '@0gfoundation/0g-storage-ts-sdk';
import { ethers } from 'ethers';
import type { HBStorage } from './storage';

export type ZeroGKvConfig = {
  rpcUrl: string;
  indexerUrl: string;
  kvNodeUrl: string;
  flowAddress: string;
  privateKey: string;
  /** bytes32 stream id — one stream for the whole app, keys are namespaced. */
  streamId: string;
};

/** Galileo testnet (chain id 16602) defaults from docs.0g.ai. */
export const GALILEO_DEFAULTS = {
  rpcUrl: 'https://evmrpc-testnet.0g.ai',
  indexerUrl: 'https://indexer-storage-testnet-turbo.0g.ai',
  kvNodeUrl: 'http://3.101.147.150:6789',
  flowAddress: '0x22E03a6A89B950F1c82ec5e74F8eCa321a105296',
  streamId: ethers.id('humanbond-v1'),
} as const;

export class ZeroGKvStorage implements HBStorage {
  private indexer: Indexer;
  private kv: KvClient;
  private flow: ReturnType<typeof FixedPriceFlow__factory.connect>;

  constructor(private cfg: ZeroGKvConfig) {
    const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
    const signer = new ethers.Wallet(cfg.privateKey, provider);
    this.indexer = new Indexer(cfg.indexerUrl);
    this.kv = new KvClient(cfg.kvNodeUrl);
    this.flow = FixedPriceFlow__factory.connect(cfg.flowAddress, signer);
  }

  async putJson(key: string, value: unknown): Promise<void> {
    const [nodes, nodesErr] = await this.indexer.selectNodes(1);
    if (nodesErr !== null) throw new Error(`0G-KV: selecting nodes failed: ${nodesErr}`);

    const batcher = new Batcher(1, nodes, this.flow, this.cfg.rpcUrl);
    batcher.streamDataBuilder.set(
      this.cfg.streamId,
      Uint8Array.from(Buffer.from(key, 'utf-8')),
      Uint8Array.from(Buffer.from(JSON.stringify(value), 'utf-8')),
    );
    const [tx, execErr] = await batcher.exec();
    if (execErr !== null) throw new Error(`0G-KV: write of "${key}" failed: ${execErr}`);
    console.log(`  0G-KV write "${key}" → tx ${tx}`);
  }

  async getJson<T>(key: string): Promise<T> {
    const parsed = await this.getJsonOrNull<T>(key);
    if (parsed === null) throw new Error(`0G-KV: no value at "${key}" in stream ${this.cfg.streamId}`);
    return parsed;
  }

  async getJsonOrNull<T>(key: string): Promise<T | null> {
    const value = await this.kv.getValue(this.cfg.streamId, Uint8Array.from(Buffer.from(key, 'utf-8')));
    if (value === null) return null;
    return JSON.parse(Buffer.from(value.data, 'base64').toString('utf-8')) as T;
  }

  async append(log: string, entry: unknown): Promise<void> {
    const entries = await this.readLog(log);
    entries.push(entry);
    await this.putJson(log, entries);
  }

  async readLog(log: string): Promise<unknown[]> {
    const value = await this.kv.getValue(this.cfg.streamId, Uint8Array.from(Buffer.from(log, 'utf-8')));
    if (value === null) return [];
    return JSON.parse(Buffer.from(value.data, 'base64').toString('utf-8')) as unknown[];
  }
}

/** Build from env. Fails hard on a missing key — no silent local fallback. */
export function zeroGKvStorageFromEnv(): ZeroGKvStorage {
  const privateKey = process.env.ZG_KV_PRIVATE_KEY;
  if (!privateKey)
    throw new Error(
      'ZG_KV_PRIVATE_KEY is not set. 0G-KV writes need a funded Galileo testnet key (faucet.0g.ai). Set it in miniapp/.env.local.',
    );
  return new ZeroGKvStorage({
    rpcUrl: process.env.ZG_RPC_URL ?? GALILEO_DEFAULTS.rpcUrl,
    indexerUrl: process.env.ZG_INDEXER_URL ?? GALILEO_DEFAULTS.indexerUrl,
    kvNodeUrl: process.env.ZG_KV_NODE_URL ?? GALILEO_DEFAULTS.kvNodeUrl,
    flowAddress: process.env.ZG_FLOW_ADDRESS ?? GALILEO_DEFAULTS.flowAddress,
    privateKey,
    streamId: process.env.ZG_KV_STREAM_ID ?? GALILEO_DEFAULTS.streamId,
  });
}
