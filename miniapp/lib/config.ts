/**
 * Global build-time configuration / feature flags.
 *
 * USE_MOCKS is resolved at BUILD TIME from NEXT_PUBLIC_USE_MOCKS. It is never
 * controllable at runtime (no query param, localStorage or UI toggle). In a
 * production build the constant folds to `false`, so every `if (USE_MOCKS)`
 * branch is removed by dead-code elimination and the `lib/mocks/*` modules are
 * tree-shaken out of the bundle. A guard in next.config.ts additionally fails
 * the production build if mocks are accidentally enabled.
 */
export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "1";

/** Fake "self" wallet address used while in mock mode. */
export const MOCK_ADDRESS = "0x1111111111111111111111111111111111111111" as const;

/** Fake partner wallet address used in mock scenarios. */
export const MOCK_PARTNER = "0x2222222222222222222222222222222222222222" as const;
