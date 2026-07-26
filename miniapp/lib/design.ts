/**
 * HumanBond design tokens — the single source for the two type roles the
 * dashboard surfaces use (profile, bond page). Full rules: docs/design-system.md.
 *
 * Only TWO type roles inside a component:
 *   1. DISPLAY — Anton, black, UPPERCASE. Section/card titles and big numbers.
 *   2. META    — Anton, small, gray, UPPERCASE. Every secondary label
 *                (ENS suffix, USDC unit, counts, validity notes).
 * Body prose (chat bubbles, inputs) stays on the sans; it is not a "role" here.
 */

/**
 * Meta text — secondary labels. Same look as the ".humanbond.eth" suffix:
 * Anton, 11px, gray, uppercase. Inline unit suffixes append `ml-1` / `ml-2`.
 * The content should already be uppercase-safe (the class also uppercases it).
 */
export const META = 'font-anton text-[11px] text-gray-400 uppercase tracking-wide';

/**
 * Display heading — pair with a size utility (`text-xl`, `text-2xl`, `text-3xl`)
 * and UPPERCASE the text. Card titles text-xl, section headings text-2xl,
 * page/greeting titles text-3xl.
 */
export const HEADING = 'font-anton text-black tracking-wide';
