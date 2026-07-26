import { notFound } from 'next/navigation';
import { SelfieCheckTestClient } from './SelfieCheckTestClient';

export default function SelfieCheckTestPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <SelfieCheckTestClient />;
}
