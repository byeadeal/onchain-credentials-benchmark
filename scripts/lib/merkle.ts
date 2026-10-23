import { keccak256, solidityPacked } from "ethers";

function hashPair(left: string, right: string): string {
  const [a, b] = left.toLowerCase() < right.toLowerCase() ? [left, right] : [right, left];
  return keccak256(solidityPacked(["bytes32", "bytes32"], [a, b]));
}

/// Sorted-pair Merkle tree. An odd node is promoted without a sibling hash.
export function merkleTree(leaves: string[]): { root: string; proofs: string[][] } {
  if (leaves.length === 0) {
    throw new Error("merkle tree needs at least one leaf");
  }

  const layers: string[][] = [leaves.slice()];
  while (layers[layers.length - 1].length > 1) {
    const current = layers[layers.length - 1];
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push(i + 1 === current.length ? current[i] : hashPair(current[i], current[i + 1]));
    }
    layers.push(next);
  }

  const proofs = leaves.map((_, leafIndex) => {
    const proof: string[] = [];
    let index = leafIndex;
    for (let level = 0; level < layers.length - 1; level++) {
      const layer = layers[level];
      const sibling = index % 2 === 0 ? index + 1 : index - 1;
      if (sibling < layer.length) proof.push(layer[sibling]);
      index = Math.floor(index / 2);
    }
    return proof;
  });

  return { root: layers[layers.length - 1][0], proofs };
}
