/**
 * Public pay page for a bond: /pay/<label>.
 *
 * Resolved server-side with the directory's trust rules, so this page only ever shows a vault
 * that resolution accepted — and says which proof it rests on.
 */
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { resolveLabel } from '@/lib/stellar/directory';
import { PayClient } from './PayClient';

export const dynamic = 'force-dynamic';

export default async function PayPage({ params }: { params: Promise<{ label: string }> }) {
  const { label } = await params;
  const resolution = await resolveLabel(label.toLowerCase());
  if (!resolution.ok) notFound();

  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const pageUrl = `${proto}://${h.get('host')}/pay/${resolution.config.link.label}`;

  return (
    <PayClient
      label={resolution.config.link.label}
      vaultId={resolution.vaultId}
      pageUrl={pageUrl}
      proof={resolution.proof}
    />
  );
}
