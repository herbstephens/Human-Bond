/**
 * The one server-side store for the negotiation layer (profiles, charters,
 * cases, history). Server-only — never import from a client component.
 *
 * Option A (server-orchestrated) does not need 0G: a process-global in-memory
 * store persists across requests within one server. It flips to real 0G-KV when
 * `ZG_KV_ENABLED=1` (a funded Galileo key). Multi-instance serverless needs
 * 0G-KV or a DB — see docs/agent-protocol.md.
 */
import { MemoryStorage, type HBStorage } from './storage';
import { zeroGKvStorageFromEnv } from './zeroGKv';

const g = globalThis as unknown as { __hbStore?: HBStorage };

export function getHbStorage(): HBStorage {
  if (process.env.ZG_KV_ENABLED === '1') return zeroGKvStorageFromEnv();
  // globalThis survives Next dev module reloads, so the singleton is stable.
  if (!g.__hbStore) g.__hbStore = new MemoryStorage();
  return g.__hbStore;
}
