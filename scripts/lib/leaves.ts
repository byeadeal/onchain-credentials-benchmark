import { keccak256, solidityPacked } from "ethers";

/// Same payload for every architecture, so gas differences come from the contract.
export function credentialHash(cohortSize: number, index: number): string {
  return keccak256(
    solidityPacked(["string", "uint256", "uint256"], ["NU-BSc-2026", cohortSize, index]),
  );
}
