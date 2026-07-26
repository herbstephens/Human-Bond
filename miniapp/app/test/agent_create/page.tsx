import { notFound } from 'next/navigation';
import { TestAgentCreateClient } from './TestAgentCreateClient';

export default function TestAgentCreatePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <TestAgentCreateClient />;
}
