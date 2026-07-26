/** The second brain moved into the profile — this route only redirects. */
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function BrainRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/profile');
  }, [router]);
  return null;
}
