/**
 * SEP-2 federation server: `alice-ben*<domain>` → the bond's joint account.
 *
 *   GET /api/federation?type=name&q=alice-ben*<domain>
 *   GET /api/federation?type=id&q=G…          (reverse lookup)
 *
 * Wallets find this endpoint through FEDERATION_SERVER in /.well-known/stellar.toml.
 * Resolution and its trust rules live in lib/stellar/directory.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { federationAddress, stellarHomeDomain } from '@/lib/stellar/config';
import { resolveLabel } from '@/lib/stellar/directory';
import { inspectJointAccount } from '@/lib/stellar/jointAccount';

// SEP-2 requires CORS so browser wallets can call us.
const HEADERS = { 'Access-Control-Allow-Origin': '*' };

function notFound(detail: string) {
  return NextResponse.json({ detail }, { status: 404, headers: HEADERS });
}

function found(label: string, accountId: string) {
  return NextResponse.json(
    { stellar_address: federationAddress(label), account_id: accountId },
    { headers: HEADERS },
  );
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  const type = request.nextUrl.searchParams.get('type');
  if (!q) return NextResponse.json({ detail: 'missing q' }, { status: 400, headers: HEADERS });

  if (type === 'name') {
    const [label, domain] = q.toLowerCase().split('*');
    if (!label || domain !== stellarHomeDomain()) return notFound(`unknown address ${q}`);
    const resolution = await resolveLabel(label);
    if (!resolution.ok) return notFound(resolution.reason);
    return found(label, resolution.account.accountId);
  }

  if (type === 'id') {
    // Only answer if the forward lookup of the account's own label lands back on it.
    const check = await inspectJointAccount(q);
    if (!check.ok) return notFound(check.reason);
    const resolution = await resolveLabel(check.account.link.label);
    if (!resolution.ok || resolution.account.accountId !== q) return notFound(`${q} has no verified name`);
    return found(check.account.link.label, q);
  }

  return NextResponse.json({ detail: `type "${type}" not supported` }, { status: 501, headers: HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'GET' } });
}
