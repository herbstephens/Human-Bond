/**
 * Storage behind one interface so 0G plugs in without touching the runtime.
 *
 * Namespaces:
 *   brain/<human>      — the second brain (profile facts, learned behavior)
 *   charter/<bondId>   — the bond's rules: split rule, hito threshold, will
 *   history/<bondId>   — append-only execution + negotiation log
 *
 * MemoryStorage runs the headless demo. ZeroGKvStorage (zeroGKv.ts) is the
 * real adapter on 0G-KV — same four methods, funded Galileo key required.
 */
export interface HBStorage {
  putJson(key: string, value: unknown): Promise<void>;
  /** Throws when the key is missing — callers must know what they expect. */
  getJson<T>(key: string): Promise<T>;
  /** For polling keys that legitimately may not exist yet (e.g. the peer's signature). */
  getJsonOrNull<T>(key: string): Promise<T | null>;
  append(log: string, entry: unknown): Promise<void>;
  readLog(log: string): Promise<unknown[]>;
}

export class MemoryStorage implements HBStorage {
  private objects = new Map<string, string>();
  private logs = new Map<string, string[]>();

  async putJson(key: string, value: unknown): Promise<void> {
    this.objects.set(key, JSON.stringify(value));
  }

  async getJson<T>(key: string): Promise<T> {
    const raw = this.objects.get(key);
    if (raw === undefined) throw new Error(`Storage miss: no object at "${key}"`);
    return JSON.parse(raw) as T;
  }

  async getJsonOrNull<T>(key: string): Promise<T | null> {
    const raw = this.objects.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  async append(log: string, entry: unknown): Promise<void> {
    const entries = this.logs.get(log) ?? [];
    entries.push(JSON.stringify(entry));
    this.logs.set(log, entries);
  }

  async readLog(log: string): Promise<unknown[]> {
    return (this.logs.get(log) ?? []).map((e) => JSON.parse(e));
  }
}

// --- typed shapes stored per namespace -------------------------------------

export type StoredProfile = {
  human: string;
  monthlyIncomeUsdc: number;
  protectedBudgetUsdc: number;
  /** Hard rule: above this, the human's hito must release. */
  hitoThresholdUsdc: number;
  facts: string[];
};

export type StoredCharter = {
  bondId: string;
  partners: [string, string];
  splitRule: 'by-income';
  /** Shared spends above this need BOTH humans' hito release. */
  jointHitoThresholdUsdc: number;
  heirs: { name: string; sharePct: number }[];
};
