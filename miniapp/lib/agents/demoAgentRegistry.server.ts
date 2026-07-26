/**
 * Hackathon AgentKit identities.
 *
 * Public addresses are safe to commit. Private keys live only in
 * miniapp/.env.local under the env names below and must never reach the client.
 * AgentBook registration is checked at runtime; presence in this table alone
 * does not mean an agent is human-backed.
 */
export type DemoAgentIdentity = {
  id: string;
  address: `0x${string}`;
  privateKeyEnv: string;
};

export const DEMO_AGENT_IDENTITIES = [
  {
    id: 'mishabunte-agent',
    address: '0xdB6cAc655C60B0192FFc2Bb17e46568964919b93',
    privateKeyEnv: 'MISHABUNTE_AGENT_PRIVATE_KEY',
  },
  {
    id: 'lunsen-agent',
    address: '0x93c98b03429661162C9B82fa5F17e700C7dc2193',
    privateKeyEnv: 'LUNSEN_AGENT_PRIVATE_KEY',
  },
  {
    id: 'herbstepens-agent',
    address: '0x6A6C09190B7cDB62a129EEB431B260fc431a8B88',
    privateKeyEnv: 'HERBSTEPENS_AGENT_PRIVATE_KEY',
  },
  {
    id: 'thefranceway-agent',
    address: '0xA6D751e10d2Be6E0950B709365c6bc5e6878B2fa',
    privateKeyEnv: 'THEFRANCEWAY_AGENT_PRIVATE_KEY',
  },
  {
    id: 'francoamicone-agent',
    address: '0x5CFC04A94E8FaAF45E82C4d09540d14084A0a030',
    privateKeyEnv: 'FRANCOAMICONE_AGENT_PRIVATE_KEY',
  },
] as const satisfies readonly DemoAgentIdentity[];

export function findDemoAgent(address: string): DemoAgentIdentity | null {
  return (
    DEMO_AGENT_IDENTITIES.find(
      (agent) => agent.address.toLowerCase() === address.toLowerCase(),
    ) ?? null
  );
}
