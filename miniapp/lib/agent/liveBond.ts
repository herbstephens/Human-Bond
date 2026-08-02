/**
 * The id of the ONE real bond in live mode.
 *
 * Deliberately in its own dependency-free module: the notification route (a
 * server route) needs it to deep-link into `/bond/<id>`, and importing it from
 * `useLiveBondSync` would drag that `'use client'` module — wagmi, zustand and
 * all — into the server bundle.
 */
export const LIVE_BOND_ID = 'main';
