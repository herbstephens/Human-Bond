/**
 * GET /api/stellar/vault?label=<ens label> — summary of the bond's Stellar vault, for the mini
 * app's read-only card. Resolved with the directory's trust rules (ENS text record, or the
 * testnet allowlist); 404 when the bond has no verified Stellar vault.
 */
import { NextRequest, NextResponse } from 'next/server';
import { resolveLabel } from '@/lib/stellar/directory';
import { readVaultState } from '@/lib/stellar/vault';
import { STELLAR, STELLAR_NETWORK } from '@/lib/stellar/config';

export type StellarVaultSummary = {
  network: 'testnet' | 'public';
  vaultId: string;
  explorerUrl: string;
  proof: 'ens' | 'testnet-allowlist';
  balance: string;
  smallSpendThreshold: string;
  dailyFreeLimit: string;
  remainingFreeAllowance: string;
  pendingCount: number;
  dissolution: { requestedAt: string; executableAt: string } | null;
  dissolved: boolean;
};

export async function GET(request: NextRequest) {
  const label = request.nextUrl.searchParams.get('label')?.toLowerCase();
  if (!label) return NextResponse.json({ detail: 'missing label' }, { status: 400 });

  const resolution = await resolveLabel(label);
  if (!resolution.ok) return NextResponse.json({ detail: resolution.reason }, { status: 404 });

  const state = await readVaultState(resolution.vaultId);
  const summary: StellarVaultSummary = {
    network: STELLAR_NETWORK,
    vaultId: state.vaultId,
    explorerUrl: `${STELLAR.explorerUrl}/contract/${state.vaultId}`,
    proof: resolution.proof,
    balance: state.balance,
    smallSpendThreshold: state.config.smallSpendThreshold,
    dailyFreeLimit: state.config.dailyFreeLimit,
    remainingFreeAllowance: state.remainingFreeAllowance,
    pendingCount: state.spends.filter((s) => s.status === 'Pending').length,
    dissolution: state.dissolution
      ? { requestedAt: state.dissolution.requestedAt.toISOString(), executableAt: state.dissolution.executableAt.toISOString() }
      : null,
    dissolved: state.dissolved,
  };
  return NextResponse.json(summary);
}
