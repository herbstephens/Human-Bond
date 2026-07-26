/**
 * Boundaries as code, not prompt hope.
 *
 * Each role gets an explicit tool allowlist. A personal agent structurally
 * CANNOT execute a payment (it has no execute tool); the trustee structurally
 * CANNOT advocate or negotiate (it has no negotiation tools). The prompts in
 * prompts.ts STATE these rules so the models behave; this file ENFORCES them
 * so a misbehaving model still can't cross the line.
 */
import type { AgentRole } from './protocol';

export type ToolName =
  // personal agents — advocate, negotiate, sign; never execute
  | 'read_own_profile'
  | 'send_to_peer'
  | 'sign_settlement'
  | 'submit_settlement'
  | 'notify_human'
  // trustee — verify and execute; never negotiate, never advocate
  | 'verify_settlement'
  | 'execute_payment'
  | 'place_investment'
  | 'report_to_humans';

export const TOOL_ACCESS: Record<AgentRole, readonly ToolName[]> = {
  personal: ['read_own_profile', 'send_to_peer', 'sign_settlement', 'submit_settlement', 'notify_human'],
  trustee: ['verify_settlement', 'execute_payment', 'place_investment', 'report_to_humans'],
};

export class ToolAccessViolation extends Error {
  constructor(role: AgentRole, tool: ToolName) {
    super(`Tool access violation: role "${role}" may not call "${tool}". Allowed: ${TOOL_ACCESS[role].join(', ')}`);
    this.name = 'ToolAccessViolation';
  }
}

export function assertToolAllowed(role: AgentRole, tool: ToolName): void {
  if (!TOOL_ACCESS[role].includes(tool)) throw new ToolAccessViolation(role, tool);
}

// ---------------------------------------------------------------------------
// Payment rail — what execute_payment actually drives.

export type PullReceipt = {
  fromHuman: string;
  amountUsdc: number;
  to: string;
  txRef: string;
};

/**
 * The trustee's hands. The real implementation maps onto the team's vault
 * layer (lib/vault + BondVaultModule.proposeSpend/approveSpend via MiniKit);
 * the mock logs and returns fake tx refs so the runtime is testable headless.
 */
export interface PaymentRail {
  /** Pull one human's share (card-on-file ERC-20 allowance) toward the recipient. */
  pull(fromHuman: string, amountUsdc: number, to: string): Promise<PullReceipt>;
  /** Move vault funds into a yield position. */
  invest(bondId: string, amountUsdc: number, aprPct: number): Promise<string>;
  /** Swap vault funds via Uniswap — minAmountOut is the agents' signed floor. */
  swap(bondId: string, tokenIn: string, tokenOut: string, amountIn: number, minAmountOut: number): Promise<string>;
}

export class MockRail implements PaymentRail {
  public log: string[] = [];
  private n = 0;

  async pull(fromHuman: string, amountUsdc: number, to: string): Promise<PullReceipt> {
    const txRef = `0xmock${(++this.n).toString().padStart(4, '0')}`;
    this.log.push(`pull ${amountUsdc.toFixed(2)} USDC from ${fromHuman} -> ${to} (${txRef})`);
    return { fromHuman, amountUsdc, to, txRef };
  }

  async invest(bondId: string, amountUsdc: number, aprPct: number): Promise<string> {
    const txRef = `0xmock${(++this.n).toString().padStart(4, '0')}`;
    this.log.push(`invest ${amountUsdc.toFixed(2)} USDC of ${bondId} at ${aprPct}% (${txRef})`);
    return txRef;
  }

  async swap(bondId: string, tokenIn: string, tokenOut: string, amountIn: number, minAmountOut: number): Promise<string> {
    const txRef = `0xmock${(++this.n).toString().padStart(4, '0')}`;
    this.log.push(`swap ${amountIn.toFixed(2)} ${tokenIn} -> ${tokenOut} (min ${minAmountOut}) for ${bondId} (${txRef})`);
    return txRef;
  }
}
