/**
 * The partners' vault page: /stellar/<label>. Spends, approvals and dissolution.
 * Resolved with the directory's trust rules; state is read live by the client.
 */
import { notFound } from 'next/navigation';
import { resolveLabel } from '@/lib/stellar/directory';
import { VaultClient } from './VaultClient';

export const dynamic = 'force-dynamic';

export default async function StellarVaultPage({ params }: { params: Promise<{ label: string }> }) {
  const { label } = await params;
  const resolution = await resolveLabel(label.toLowerCase());
  if (!resolution.ok) notFound();
  return <VaultClient label={resolution.config.link.label} vaultId={resolution.vaultId} />;
}
