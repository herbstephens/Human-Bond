/**
 * SEP-1 stellar.toml. Tells Stellar wallets where our federation server is, so a payer can type
 * `alice-ben*<domain>` instead of a 56-character account id. Every joint account sets its
 * home_domain to this domain, which lets wallets check the link from both sides.
 */
import { STELLAR, stellarHomeDomain } from '@/lib/stellar/config';

export function GET() {
  const domain = stellarHomeDomain();
  const toml = [
    `VERSION="2.7.0"`,
    `NETWORK_PASSPHRASE="${STELLAR.passphrase}"`,
    `FEDERATION_SERVER="https://${domain}/api/federation"`,
    '',
    '[DOCUMENTATION]',
    'ORG_NAME="HumanBond"',
    `ORG_URL="https://${domain}"`,
    'ORG_DESCRIPTION="Proof-of-humanity partnerships. Each bond has a 2-of-2 joint account on Stellar."',
    '',
  ].join('\n');

  return new Response(toml, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // SEP-1 requires CORS on stellar.toml.
      'Access-Control-Allow-Origin': '*',
    },
  });
}
