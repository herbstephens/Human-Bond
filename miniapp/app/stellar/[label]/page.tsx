/**
 * The partners' vault page: /stellar/<label>. Spends, approvals, dissolution, will and proof of life.
 * Resolved with the directory's trust rules; state is read live by the client.
 */
import { notFound } from 'next/navigation';
import { resolveLabel } from '@/lib/stellar/directory';
import { VaultClient } from './VaultClient';

export const dynamic = 'force-dynamic';

export default async function StellarVaultPage({
  params,
  searchParams,
}: {
  params: Promise<{ label: string }>;
  searchParams: Promise<{ will?: string }>;
}) {
  const [{ label }, { will }] = await Promise.all([params, searchParams]);
  const resolution = await resolveLabel(label.toLowerCase());
  if (!resolution.ok) notFound();
  // `will`: a will partner 1 signed, for partner 2 to check and co-sign (public, call-specific data).
  return <VaultClient label={resolution.config.link.label} vaultId={resolution.vaultId} pendingWill={will ?? null} />;
}
