import { notFound } from 'next/navigation';
import { IdentityCheckTestClient } from './IdentityCheckTestClient';

export default function IdentityCheckTestPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <IdentityCheckTestClient />;
}
