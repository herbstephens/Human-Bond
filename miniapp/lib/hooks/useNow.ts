'use client';

/**
 * The current second, but only while something is actually counting down.
 *
 * The naive version (`useState` + an unconditional `setInterval`) re-renders its
 * whole subtree once a second forever — on the bond dashboard that meant the
 * dissolution section, its card and every child re-rendering every second even
 * with no dissolution open. Gating the interval on a flag instead leaves the
 * stored value stale from mount, so the first second after a request showed the
 * wrong remainder.
 *
 * `useSyncExternalStore` solves both: nothing is subscribed while `active` is
 * false, and the snapshot is read fresh at render time so it can never be stale.
 * The snapshot is quantised to whole SECONDS on purpose — returning raw
 * `Date.now()` would differ on every call and spin React forever.
 */
import { useCallback, useSyncExternalStore } from 'react';

const NOOP = () => () => {};
const getSecond = () => Math.floor(Date.now() / 1000);
/** SSR has no clock worth reporting; the first client render corrects it. */
const getServerSecond = () => 0;

/** Epoch MILLISECONDS, updated once a second while `active`. */
export function useNow(active: boolean): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!active) return NOOP();
      const id = setInterval(onChange, 1000);
      return () => clearInterval(id);
    },
    [active],
  );
  return useSyncExternalStore(subscribe, getSecond, getServerSecond) * 1000;
}
