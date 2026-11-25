import { expect } from "chai";
import { ethers } from "hardhat";
import { describe, it } from "mocha";

import { credentialHash } from "../scripts/lib/leaves";
import { merkleTree } from "../scripts/lib/merkle";

describe("Credential Revocation Correctness", function () {

  // Test 1: HashRegistry
  it("revokes one hash without invalidating another", async function () {
    const contract = await (
      await ethers.getContractFactory("HashRegistry")
    ).deploy();

    await contract.waitForDeployment();

    const hashes = [
      credentialHash(2, 0),
      credentialHash(2, 1)
    ];

    for (const hash of hashes) {
      await (await contract.issue(hash)).wait();
    }

    expect(await contract.verify(hashes[0])).to.equal(true);
    expect(await contract.verify(hashes[1])).to.equal(true);

    // Revoke only the first credential.
    await (await contract.revoke(hashes[0])).wait();

    expect(await contract.verify(hashes[0])).to.equal(false);
    expect(await contract.verify(hashes[1])).to.equal(true);
  });


  // Test 2: SoulboundCredential
  it("revokes one token without invalidating another", async function () {
    const contract = await (
      await ethers.getContractFactory("SoulboundCredential")
    ).deploy();

    await contract.waitForDeployment();

    const signers = await ethers.getSigners();

    const hashes = [
      credentialHash(2, 0),
      credentialHash(2, 1)
    ];

    await (
      await contract.mint(signers[0].address, hashes[0])
    ).wait();

    await (
      await contract.mint(signers[1].address, hashes[1])
    ).wait();

    // The existing benchmark assumes token IDs start at 1.
    expect(await contract.verify(1)).to.equal(true);
    expect(await contract.verify(2)).to.equal(true);

    // Revoke only token 1.
    await (await contract.revoke(1)).wait();

    expect(await contract.verify(1)).to.equal(false);
    expect(await contract.verify(2)).to.equal(true);
  });


  // Test 3: MerkleCredentialAnchor
  it("revokes one Merkle leaf without invalidating another", async function () {
    const contract = await (
      await ethers.getContractFactory("MerkleCredentialAnchor")
    ).deploy();

    await contract.waitForDeployment();

    const leaves = [
      credentialHash(2, 0),
      credentialHash(2, 1)
    ];

    const { root, proofs } = merkleTree(leaves);

    const batchId = 2;

    // Anchor the original Merkle root.
    await (
      await contract.anchor(batchId, root)
    ).wait();

    // Both credentials should initially be valid.
    expect(
      await contract.verify(batchId, leaves[0], proofs[0])
    ).to.equal(true);

    expect(
      await contract.verify(batchId, leaves[1], proofs[1])
    ).to.equal(true);

    // Revoke only the first leaf.
    await (
      await contract.revoke(leaves[0])
    ).wait();

    // The revoked leaf must fail verification.
    expect(
      await contract.verify(batchId, leaves[0], proofs[0])
    ).to.equal(false);

    // The other leaf must remain valid.
    expect(
      await contract.verify(batchId, leaves[1], proofs[1])
    ).to.equal(true);
  });

});
