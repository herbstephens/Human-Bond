# HumanBond Design CI — Dashboard Surfaces

The design language for the logged-in dashboard surfaces (`/profile`, `/bond/[id]`).
Tokens live in `miniapp/lib/design.ts` (`META`, `HEADING`). Import them; do not
re-hardcode the class strings.

> The older "warm dark editorial" aesthetic in `CLAUDE.md → Design & Copy` still
> governs the agent-chat/onboarding surfaces. These rules govern the dashboard.

## 1. Type — only two roles inside a component

Every component uses at most **two** type roles. Nothing else.

- **DISPLAY (Anton)** — `HEADING` = `font-anton text-black tracking-wide`, plus a
  size and `.toUpperCase()` on the text. Card titles `text-xl`, section headings
  `text-2xl`, page/greeting titles + hero numbers `text-3xl`.
- **META (Anton, small, gray)** — `META` = `font-anton text-[11px] text-gray-400
  uppercase tracking-wide`. Every secondary label: the ENS suffix
  (`.HUMANBOND.ETH`), the `USDC` unit, counts/summaries (`8 THINGS YOUR AGENT
  KNOWS`), validity notes. Inline unit suffixes append `ml-1` / `ml-2`.

**Section sublines** — the one line directly under a heading (e.g. "It serves the
bond, not either of you…") are labels, so they are `META`, not sans. Only these
stay on the sans (Geist): chat bubbles, form inputs/placeholders, and multi-line
fine-print disclaimers. Anton is registered as `font-anton` via `next/font/local`
(`app/fonts/Anton-Regular.ttf`, wired in `app/layout.tsx` + `globals.css`).

Rule of thumb: titles and labels (including section sublines) are Anton. Only a
paragraph you sit and read (a chat message, an input, fine print) is sans. In the
simple summary components (Second Brain, proof-of-life, bond cards) there is no
sans at all — only the two Anton roles.

## 2. Surfaces & borders

- Page background `bg-[#E8E8E8]`. Cards `bg-white rounded-2xl` (larger surfaces
  `rounded-[1.75rem]` / `rounded-[2rem]`; the money card is dark `bg-[#1A1A1A]`).
- **No borders on cards.** A white card sits on the gray page with no frame.
  Separate rows with `divide-y divide-gray-100` or a single `border-t
  border-gray-100`, never a full card outline. **No borders inside borders.**
- Dashed border is allowed only as an *add affordance* (`border border-dashed
  border-gray-300`), e.g. "Start a new bond", "Add something about yourself".

## 3. Color

- Text: `text-black` / `text-gray-900` (primary), `text-gray-400` (meta),
  `text-gray-500` (sublines).
- **No amber / yellow anywhere.** Status colors are **red** (urgent) and
  **emerald** (ok) only; a neutral/mid state is gray. Range inputs `accent-black`.

## 4. Components

- **List rows (Rules, Activity, and any key/value or ledger list)** — one row
  pattern, no exceptions: the primary value on the **left** in dark Anton
  (`font-anton text-[11px] text-gray-700 uppercase tracking-wide`), the secondary
  detail/label on the **right** in `META`. No sans, no mono, no `font-black`
  inside a row. Numbers included — they are Anton, never mono. Rules is the
  reference row; Activity must look identical to it.
- **Expandable cards** — tap the whole card to expand; **no chevron icon**.
  Label left (DISPLAY), summary right (META).
- **CTA** — `<CtaButton>` / `<AliveCta glow={false}>`: black pill, white text,
  uppercase, `rounded-xl`, `active:scale-[0.98]`. **No amber glow.** Back / cancel
  is a text link (`text-gray-400`), never a button.
- **Money** — amounts without decimals on dashboards; `USDC` as an inline META
  suffix after the number (or big gray next to a hero number). ENS shown as
  `NAME` (DISPLAY) + `.HUMANBOND.ETH` (META).
- **Send / Receive USDC** — reuse `SendFundsForm` + `useVaultActions` (real,
  mock-aware via `lib/mocks/mockTx`) and a Receive popup with the ENS name +
  raw address to copy. Gate on `vault.isCreated`, not on `!USE_MOCKS`.

## 5. Reference implementation

`/profile` (`app/profile/page.tsx`) is the canonical implementation of these
rules. Match it when building or refactoring any dashboard surface.
