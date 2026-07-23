import { CONTRACT_ADDRESSES } from "@/lib/contracts";

interface DebugProposalUIProps {
  partnerAddress: string;
  merkleRoot: string | null;
  nullifierHash: string | null;
  proof: string | null;
  decodedProof: string[] | null;
  status: string;
  error: string | null;
  txHash: string | null;
}

export function DebugProposalUI({
  partnerAddress,
  merkleRoot,
  nullifierHash,
  decodedProof,
  status,
  error,
  txHash,
}: DebugProposalUIProps) {
  return (
    <div className="mt-8 p-4 bg-gray-100 rounded-lg text-xs font-mono break-all border border-gray-300">
      <h3 className="text-sm font-bold mb-2 uppercase text-gray-700">🔍 Debug Info (On-Chain Data)</h3>
      
      <div className="space-y-4">
        <div>
          <span className="font-semibold text-gray-600">Contract Address (HumanBond):</span>
          <div className="bg-white p-2 rounded border mt-1">
            {CONTRACT_ADDRESSES.HUMAN_BOND}
          </div>
        </div>

        <div>
          <span className="font-semibold text-gray-600">Status:</span>
          <div className="bg-white p-2 rounded border mt-1">
            {status}
          </div>
        </div>

        {error && (
          <div>
            <span className="font-semibold text-red-600">Error:</span>
            <div className="bg-red-50 p-2 rounded border border-red-200 mt-1 text-red-600">
              {error}
            </div>
          </div>
        )}

        <div>
          <span className="font-semibold text-gray-600">Inputs:</span>
          <div className="bg-white p-2 rounded border mt-1 space-y-1">
            <div><span className="text-gray-400">Partner:</span> {partnerAddress || "(empty)"}</div>
          </div>
        </div>

        {(merkleRoot || nullifierHash) && (
          <div>
            <span className="font-semibold text-gray-600">World ID Verification:</span>
            <div className="bg-white p-2 rounded border mt-1 space-y-2">
              <div>
                <span className="text-gray-400">Merkle Root (uint256):</span>
                <br/>
                {merkleRoot}
              </div>
              <div>
                <span className="text-gray-400">Nullifier Hash (uint256):</span>
                <br/>
                {nullifierHash}
              </div>
            </div>
          </div>
        )}

        {decodedProof && (
          <div>
            <span className="font-semibold text-gray-600">Decoded Proof (uint256[8]):</span>
            <div className="bg-white p-2 rounded border mt-1">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(decodedProof, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {txHash && (
          <div>
             <span className="font-semibold text-gray-600">Transaction Hash:</span>
             <div className="bg-white p-2 rounded border mt-1">
               <a 
                 href={`https://worldscan.org/tx/${txHash}`} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="text-blue-600 hover:underline"
               >
                 {txHash}
               </a>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
