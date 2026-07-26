# Developer Feedback — HumanBond (ETHGlobal Lisbon 2026)

## World

HumanBond's shared-vault trustee agent uses World AgentKit's AgentBook to decide who is allowed to act on behalf of a bonded two-person partnership. The chain runs in three steps. First, World's identity verification, Selfie Check or Identity Check, confirms a real, unique human. Second, that verified human's World Chain address is bound to their Bond Agent's address, registered through AgentKit (npx@worldcoin/agentkit-cli register) under a World ID nullifier, an on-chain record that this agent is authorized to act for this human. Third, AgentKit enforces that binding at runtime: before the trustee honors any agent request, it resolves the requesting wallet to its linked Bond Agent and runs an AgentBook lookup (createAgentBookVerifier().lookupHuman(address)) to confirm a verified human still stands behind it. Because a bond always has two partners, it also runs a distinct-humans check, confirming the two agents proposing a shared spend answer to two different verified humans. An unregistered or unlinked agent is rejected outright. This is an authorization decision over who is allowed to move money inside a shared financial trust, in the vertical of shared family finance and inheritance.

Selfie Check
Selfie Check is the proof-of-life heartbeat that keeps a bond's inheritance state alive. Every 90 days, a partner re-verifies with Selfie Check to reset the clock. A missed heartbeat moves the bond into a death state, at which point heirs can claim their share according to the terms set while both partners were alive. Selfie Check carries a real consequence: whether an estate stays in the hands of its living owner or transfers to heirs.

Identity Check
Identity Check requests a World ID 4.0 identity attestation confirming a partner is at least 18, through IDKit's identityCheck preset: IDKit.request().preset(identityCheck({ attributes: [{ type:'minimum_age', value: 18 }] })). The result is verified server side against World's own verification API before being attached to a bond's record. A registered partnership carries real legal weight in many jurisdictions, inheritance, tax, and property rights among them, so confirming both partners are adults is eligibility information a partnership protocol needs to be legally legible.

## World Feedback

AgentKit, testing documentation
Developer feedback: Registration itself is smooth to build against. npx @worldcoin/agentkit-cli register is gasless, runs through a hosted relay, and needs one World App prompt. A live run (agent 0x4bF9559Be94254b4Cd8608c09EdE9b4c93ca04a1) showed the actual mechanics end to end: a bridge session opens, polls AgentBook repeatedly, 12 times in this run, then returns a real humanId confirming the agent as human-backed. Backgrounding or closing the mini app mid-registration is expected and safe, the server holds the session and keeps polling without you, but that wasn't obvious until we hit it, and it's worth documenting explicitly since a builder's first instinct is to assume closing the app cancels the flow. Separately, the core primitive builders want first, given a wallet, is a verified human behind it, is one call, createAgentBookVerifier().lookupHuman(address), found only by reading the package's TypeScript declarations, not the docs. Honestly: while agent-initiated spends now route through hito approval instead of auto-executing, the AgentBook human-backing check itself is not yet part of that execution path, it's still a separate check ahead of it. That connection is the specific piece of work left before this runs end to end for real money.

User feedback: AgentKit registration is a one-time action taken by whoever owns an agent, not a repeated end-user interaction the way Selfie Check's heartbeat is. There isn't a separate end-user feedback loop for registration itself to report here.

Selfie Check, testing documentation
Developer feedback: Credential identifiers are buried, selfieCheckLegacy, proofOfHuman, identityCheck, passport are the real credential IDs, and how they map to what users see in World App took real digging, the credentials page isn't linked from where builders actually start. The "Legacy" suffix on the credential this track is built on raises a question the docs don't answer, is it being phased out. Whether proofs verify on-chain or only through the cloud API is also unclear from public docs, so we built a swappable verifier seam around not knowing. VerificationLevel.Device through MiniKit.commandsAsync.verify integrated cleanly once we found the right call, that part worked as documented.

User feedback: "Verify World ID" did not read as "log in" to testers, renaming the landing CTA to "Login with World ID" removed the hesitation entirely. Framing Selfie Check as a recurring heartbeat, look into the camera every 90 days or your bond starts asking questions, felt natural to testers rather than intrusive, confirmed on a real device with a real "You're alive, heartbeat renewed on-chain" success screen, not a simulation. One session-state bug surfaced, a stale client showed an old screen until reload, our bug rather than World's, but it read to the tester as "World login didn't work."

Still open: outside-tester quotes from people who aren't the team are not yet collected.

Identity Check, testing documentation Developer feedback: Built as a real World ID 4.0 identity attestation request through IDKit's identityCheck preset for minimum age 18, with server-side RP context signing and verification against World's own v4/verify API, not a mock. Testing it against live infrastructure surfaced a real failure: "Passport verification failed, World App was unable to verify your passport, please try again or use a different document." That rejection happened at World App's own native passport-scan step, before HumanBond's server verification code runs, so it reads as a World-side or document-side issue rather than a bug in our integration, but we don't yet know which without more test runs across different documents.


## ENS

Every HumanBond partnership gets an ENS subname the moment its shared Safe is created, partner1-partner2.humanbond.eth, minted through a custom registrar contract, HumanBondRegistrar, deployed against Durin's L2 registry infrastructure for humanbond.eth.

Registration is enforced on-chain around a single invariant: the name follows the vault. register() reverts unless the caller already has an active bond with a deployed Safe, so a couple with no shared wallet has nothing for the name to point at. The subname NFT is minted to the Safe itself. Holding the name and holding the vault are the same thing, neither partner can move or sell the name alone, since doing so would require a 2-of-2 Safe transaction. That's the subname functioning as an access token.

At mint time, the contract writes address resolution for both the standard coinType and Worldchain's ENSIP-11 coinType, since the Safe lives on World Chain specifically, plus an ENSIP-12 NFT avatar pointing at the bond's certificate token when one exists.

Text records carry structured, purpose-built metadata. com.humanbond.credential stores a verifiable credential string, worldid-orb:2;verify=eip155:{chainId}:{humanBondAddress}.bonds, a pointer to the bond's own on-chain existence, since HumanBond never persists World ID nullifiers to republish them directly. A bond only exists if two distinct Orb-verified humans each supplied a valid World ID proof, so the credential this record actually asserts, "two unique verified humans formed this partnership," is checkable by anyone against the protocol directly. Alongside it: com.humanbond.partners (both wallet addresses), com.humanbond.bond-id, com.humanbond.bonded-at, com.humanbond.status (written as "active" from the start so it's never ambiguously missing), and com.humanbond.years, updated through a separate syncMilestone() call either partner can trigger to publish the partnership's anniversary count. lib/ens/autoLabel.ts generates label candidates from both partners' World usernames, checks on-chain availability through available() before proposing one, and falls back to a bondId-derived label if every username variant is taken, guaranteeing the registration flow always resolves to an available name.

The result: anyone paying that partnership, a client, a family member, an employer, resolves partner1-partner2.humanbond.eth to reach the partnership's shared receiving address directly.

## ENS Feedback

ENS integration notes
Building HumanBondRegistrar against Durin's L2 registry surfaced a few real constraints worth documenting. DNS label length is a hard ceiling the registry itself doesn't enforce. Durin's registry allows labels up to 255 bytes, but anything past 63 produces a name resolvers and browsers refuse outright. The contract caps labels at 63 explicitly, that's a gap between what the infrastructure permits and what the DNS ecosystem actually supports, and it's easy to miss until a long auto-generated label from two World usernames silently fails downstream.

World App wallets complicated a design assumption: they are ERC-4337 smart accounts with no ECDSA key to verify a signature against, so partner identity in register() runs on msg.sender alone, the same pattern already used in the vault module. Any ENS integration built against World App needs msg.sender-based identity as a starting design choice.

NFT avatars follow ENSIP-12 correctly, and most third-party ENS clients only render NFT avatars sourced from mainnet, so a Worldchain-native avatar renders fully inside HumanBond's own app and may render inconsistently in other clients.

Coin type handling needed to cover two cases at once, standard coinType 60 for tools and wallets that default to it, and the ENSIP-11 Worldchain coin type for the chain the funds actually live on. Setting only one would leave either generic ENS tooling or Worldchain-aware tooling unable to resolve the address correctly.

One subtlety worth flagging for other teams using Durin: text records get applied inside create Subnode through ENS's Multicallable, which delegatecalls each entry. That preserves msg.sender as the registrar contract itself, which is what keeps registrar authorization valid across all nine records written at mint time. Missing that detail would break write permissions in a way that's not obvious from the error alone.

On the product side, per the plan's own framing, autoLabel.ts generates label candidates from both partners' World usernames first, checks availability on-chain before proposing one, and falls back to a bondId-derived label, so the flow always resolves to something available, even when usernames collide or contain characters outside the label charset.


## Zero Gravity (0G)

HumanBond's personal and trustee agents run their inference through 0G Compute's router, https://router-api.0g.ai/v1, model zai-org/GLM-5-FP8, with separate environment overrides for chat versus negotiation so each role can point at a different router or model independently. /api/agent/chat is the live route a partner's personal agent talks through: free text goes to the model, and the model decides whether a request is a shared spend, at which point it returns a propose_spend action rather than executing anything itself.

Everything the agents need to remember, and their own signing keys, live on 0G Storage through a custom KV client, ZeroGKvStorage, built against @0gfoundation/0g-storage-ts-sdk. Writes go through a funded flow contract on the Galileo testnet, reads go straight to a KV node, and keys are namespaced by purpose: brain/<human> for a person's second brain, charter/<bondId> for the partnership's charter, history/<bondId> for the settlement log, and agent-keys/<address> for each Bond agent's own private key, AES-encrypted before it ever reaches storage, alongside agent-owner/<wallet> recording which agent acts for which human. That log is read-modify-write JSON under its own key, so an agent's reasoning, its past actions, and its own credentials all stay retrievable on 0G rather than existing only in a running process.

The two connect directly. When the model returns propose_spend, the amount and recipient flow into a real on-chain call, BondVaultModule.proposeSpend through MiniKit, gated behind explicit hito approval before anything moves. So the path from an agent's decision to a proposal a human has to sign runs through 0G Compute for the reasoning, 0G Storage for what the agent remembers and for the key that identifies it, and the vault contract for what actually executes.

## 0G Feedback

Building on 0G-KV surfaced a genuine consistency bug worth documenting for other teams. 0G-KV is eventually consistent: a write submits a storage transaction, and the KV node indexes it afterward. The agent activation flow writes a key in /activate/start and reads it back seconds later in /activate/complete, well inside that indexing window, so the read hung until the client timed out and registration never reached the relay. The fix was an in-process cache that serves a read-your-own-write for anything this process just wrote, falling back to the network for everything else. That's a real gap between how a KV store is usually assumed to behave and how 0G-KV actually behaves under fast sequential writes.

Writes also require a funded key on the Galileo testnet, through faucet.0g.ai, before anything can be stored at all. A separate feature, a multi-browser agent message bus built entirely on 0G-KV, turn-based conversation writes, per-agent signature keys, deterministic settlement hashing on both sides, is real, working code, 167 lines, but stayed blocked for the weekend purely on testnet faucet funding, not on the SDK or the API, worth flagging since it's pure infrastructure friction rather than an integration problem.

The log storage pattern, read-modify-write JSON arrays under a single key for each bond's settlement history, works cleanly at demo write volume but is an honest scaling caveat: two concurrent writers to the same log key would race, since append() reads, modifies, then writes as three separate unsynchronized steps, that's a limitation of the current implementation rather than something 0G-KV itself prevents.
