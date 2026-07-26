import { notFound } from 'next/navigation';
import { ZeroGHooksTestClient } from './ZeroGHooksTestClient';

export default function ZeroGHooksTestPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <ZeroGHooksTestClient />;
}
