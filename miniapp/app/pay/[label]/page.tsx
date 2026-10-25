/**
 * Public pay page for a bond: /pay/<label>.
 *
 * Resolved server-side with the same trust rules as the federation server, so this page only
 * ever shows an account that resolution accepted — and says which proof it rests on.
 */
import { notFound } from 'next/navigation';
import { resolveLabel } from '@/lib/stellar/directory';
import { federationAddress } from '@/lib/stellar/config';
import { PayClient } from './PayClient';

export const dynamic = 'force-dynamic';

export default async function PayPage({ params }: { params: Promise<{ label: string }> }) {
  const { label } = await params;
  const resolution = await resolveLabel(label.toLowerCase());
  if (!resolution.ok) notFound();

  return (
    <PayClient
      label={resolution.account.link.label}
      accountId={resolution.account.accountId}
      address={federationAddress(resolution.account.link.label)}
      proof={resolution.proof}
    />
  );
}
