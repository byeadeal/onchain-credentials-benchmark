import { AbiCoder, keccak256 } from "ethers";

const coder = AbiCoder.defaultAbiCoder();

export function credentialHash(cohortSize: number, index: number): string {
  return keccak256(coder.encode(["string", "uint256", "uint256"], ["NU-BSc-2026", cohortSize, index]));
}
