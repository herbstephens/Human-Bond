import { notFound } from 'next/navigation';
import { AgentBridgeClient } from './AgentBridgeClient';

export default function AgentBridgeTestPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <AgentBridgeClient />;
}
