# Identity Stack

HumanBond uses World's identity stack to verify both partners are real, unique humans — the foundational requirement for a meaningful partnership protocol.

---

## The Three Tiers

### Tier 1 — Selfie Check (World beta)

**What it is:** A selfie-based credential confirming a real, live person is present. No government ID required. Works on any modern smartphone.

**How it works:**
1. Partner opens HumanBond in World App
2. Prompted to complete Selfie Check
3. Camera captures a short selfie video
4. World's liveness detection confirms: real person, not a photo or deepfake
5. Credential issued — tied to World ID nullifier

**What it proves:**
- A real, live human is present at time of verification
- The person is not a bot or automated script
- Does NOT prove uniqueness (one person could make multiple selfie accounts)

**In HumanBond:** Lowest friction entry point. Bonds formed at Tier 1 are marked accordingly in the VowNFT. Income splits work the same as higher tiers. Governance weight in TIME Protocol is reduced.

**ETHGlobal Lisbon:** World Selfie Check Beta prize track ($3,500). We provide testing documentation with developer and user feedback on the selfie flow.

---

### Tier 2 — NFC Credentials (World beta)

**What it is:** Reads the NFC chip embedded in a biometric passport (or national ID in supported countries). Cryptographically verifies the chip signature issued by the country's government. Extracts verified attributes without storing the underlying document.

**How it works:**
1. Partner holds their passport near their phone
2. Phone reads the NFC chip via World's NFC Credentials SDK
3. World verifies the chip's cryptographic signature (government-issued)
4. Attributes extracted:
   - **Age verification:** confirms partner is over 18
   - **Jurisdiction:** country of document issuance
   - (optionally) document type and expiry
5. ZK proof generated — attributes proved without revealing the raw document

**What it proves:**
- Real government-issued ID exists
- Holder is over 18 years old
- Jurisdiction (country) of the document
- Does NOT reveal: name, document number, photo, or any other personal data

**In HumanBond:** Preferred tier. Jurisdiction verification opens the door to legally meaningful partnerships (inheritance, tax, property). Income splits and governance weight at standard level. Partnership Registry can be queried for `identityTierA >= 2` by institutions requiring document-backed identity.

**ETHGlobal Lisbon:** World Identity Check (NFC) Beta prize track ($3,500). We provide testing documentation.

---

### Tier 3 — Proof of Humanity (World Orb)

**What it is:** Biometric iris scan performed by a World Orb device. The strongest available proof of unique humanity. One person, one identity, worldwide.

**How it works:**
1. Partner visits a World Orb location
2. Iris is scanned by the Orb hardware
3. Biometric uniqueness verified against global registry
4. ZK proof of uniqueness generated — iris data is never stored
5. World ID issued at Orb level

**What it proves:**
- This is a unique, living human being
- No other World Orb account exists for this person
- Strongest resistance to sybil attacks

**In HumanBond:** Highest assurance. Full governance weight in TIME Protocol. Required for Age Grant (retroactive birthright TIME). Required for full Partnership Score in Reputation dimension. Recommended for partnerships with legal or financial implications.

---

## Identity Tier Comparison

| | Tier 1: Selfie | Tier 2: NFC | Tier 3: Orb |
|---|---|---|---|
| **Friction** | Very low | Low | Medium (Orb visit) |
| **ID required** | No | Yes (passport) | No (but iris scan) |
| **Proves liveness** | ✓ | ✓ | ✓ |
| **Proves uniqueness** | Partial | Partial | ✓ Strong |
| **Proves age >18** | ✗ | ✓ | ✗ (indirectly) |
| **Proves jurisdiction** | ✗ | ✓ | ✗ |
| **Document-backed** | ✗ | ✓ | ✗ |
| **TIME Protocol weight** | Reduced | Standard | Full |
| **Age Grant eligible** | ✗ | ✗ | ✓ |
| **Partnership Score boost** | Base | Standard | Full |

---

## Tier Upgrades

Tiers are upgradeable — never downgradeable. A partner who begins at Tier 1 (Selfie) can upgrade to Tier 2 (NFC) or Tier 3 (Orb) at any time. When they upgrade:

1. World ID tier is updated
2. VowNFT identity tier record is updated (immutably — the upgrade is recorded alongside the original)
3. TIME Protocol weight increases immediately
4. Partnership Score updates

Upgrading does not require dissolving and reforming the bond. The bond record shows both the original tier and the current tier.

---

## Privacy Design

World ID is designed for minimal disclosure:

- **Nullifier hash** identifies the user uniquely per application — the same person has different nullifiers in different apps, preventing cross-app tracking
- **No biometric data stored** — iris scan data is never retained after verification; only the mathematical proof of uniqueness
- **Attribute proofs** (for Tier 2) reveal only what's needed: "age > 18" not "born on this date"; "document from Portugal" not "passport number X"
- **HumanBond** stores only the nullifier hash and identity tier — never names, addresses, document numbers, or biometric data

---

## MiniKit Integration

```javascript
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js'

// Tier 3: World Orb verification
const { finalPayload } = await MiniKit.commandsAsync.verify({
  action: 'humanbond-propose',   // unique per action
  signal: partnerBNullifierHash, // bind to this specific bond
  verification_level: VerificationLevel.Orb,
})

// Tier 2: NFC Credentials (World beta)
// attribute_requests specifies what to prove from the document
const { finalPayload } = await MiniKit.commandsAsync.verify({
  action: 'humanbond-propose-nfc',
  signal: partnerBNullifierHash,
  verification_level: VerificationLevel.Device, // pending NFC-specific level
  // attribute_requests: ['age_over_18', 'document_country']
})

// Tier 1: Selfie Check (World beta)
const { finalPayload } = await MiniKit.commandsAsync.verify({
  action: 'humanbond-propose-selfie',
  signal: partnerBNullifierHash,
  verification_level: VerificationLevel.Device,
})

// Submit proof to contract
await HumanBondContract.proposeBond(
  finalPayload.merkle_root,
  finalPayload.nullifier_hash,
  finalPayload.proof,
  identityTier,  // 1, 2, or 3
)
```

---

*democracy.earth · timeprotocol.earth · July 2026*
