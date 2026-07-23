type ProofTuple = [string, string, string, string, string, string, string, string];

/**
 * Decode a World ID proof hex string into a uint256[8] array
 * suitable for on-chain verification.
 */
export function decodeProof(proof: string): ProofTuple {
  const cleanProof = proof.startsWith("0x") ? proof.slice(2) : proof;
  const proofArray: string[] = [];
  for (let i = 0; i < 8; i++) {
    const chunk = cleanProof.slice(i * 64, (i + 1) * 64);
    proofArray.push(BigInt("0x" + chunk).toString());
  }
  return proofArray as ProofTuple;
}
